import { createContext, useContext, useState, useEffect } from 'react';
import { api, isTransientApiError } from '../api/client';

const AuthContext = createContext(null);

// Backoff for restoring a saved session the server couldn't confirm on load (~3.5 min in all).
const SESSION_RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 40_000, 60_000, 75_000];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('homelink_token');
    if (!token) {
      setLoading(false);
      return undefined;
    }
    let stopped = false;
    // Signing in or out meanwhile replaces the token, which ends this check.
    const stillSaved = () => !stopped && localStorage.getItem('homelink_token') === token;

    (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const me = await api.get('/auth/me');
          if (stillSaved()) setUser(me);
          return;
        } catch (err) {
          // Only a server that answered and turned the token away ends the session. A dropped
          // connection, a server still waking up or a database too busy to answer says nothing
          // about the token -- clearing it there signed a whole room out at once whenever the
          // server struggled, and every one of them signing back in only added to the load. The
          // page carries on signed out meanwhile, and the session comes back once it answers.
          if (!isTransientApiError(err)) {
            if (stillSaved()) localStorage.removeItem('homelink_token');
            return;
          }
          if (attempt >= SESSION_RETRY_DELAYS_MS.length) return;
        } finally {
          if (attempt === 0 && !stopped) setLoading(false);
        }
        await new Promise((resolve) => setTimeout(resolve, SESSION_RETRY_DELAYS_MS[attempt]));
        if (!stillSaved()) return;
      }
    })();

    return () => { stopped = true; };
  }, []);

  // `portal` is the staff portal's chosen role — the backend turns away a different role.
  const login = async (email, password, { portal } = {}) => {
    const data = await api.post('/auth/login', { email, password, portal });
    if (data.requires2FA) return { requires2FA: true, email: data.email };
    localStorage.setItem('homelink_token', data.token);
    setUser(data.user);
    return { requires2FA: false, user: data.user };
  };

  const verifyTwoFactor = async (email, code) => {
    const data = await api.post('/auth/verify-2fa', { email, code });
    localStorage.setItem('homelink_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const sendTwoFactorSetupCode = () => api.post('/auth/two-factor/send-code', {});

  const setTwoFactorEnabled = async (enabled, code) => {
    const data = await api.put('/auth/two-factor', { enabled, code });
    setUser(prev => ({ ...prev, twoFactorEnabled: data.twoFactorEnabled }));
    return data;
  };

  const register = async (form) => {
    const data = await api.post('/auth/register', form);
    localStorage.setItem('homelink_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const loginWithGoogle = async (credential, { mode } = {}) => {
    const data = await api.post('/auth/google', { credential, mode });
    if (data.requires2FA) return { requires2FA: true, email: data.email };
    localStorage.setItem('homelink_token', data.token);
    setUser(data.user);
    return { requires2FA: false, user: data.user };
  };

  const logout = () => {
    localStorage.removeItem('homelink_token');
    setUser(null);
  };

  const updateProfile = async (form) => {
    await api.put('/auth/profile', form);
    setUser(prev => ({ ...prev, ...form }));
  };

  // A data URL to set the photo, or null to remove it.
  const updateAvatar = async (avatar) => {
    const data = await api.put('/auth/avatar', { avatar });
    setUser(prev => ({ ...prev, avatar: data.avatar }));
  };

  const refreshUser = async () => {
    const data = await api.get('/auth/me');
    setUser(data);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyTwoFactor, register, loginWithGoogle, logout, updateProfile, updateAvatar, refreshUser, setTwoFactorEnabled, sendTwoFactorSetupCode }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
