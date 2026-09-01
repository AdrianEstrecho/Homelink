import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('homelink_token');
    if (token) {
      api.get('/auth/me').then(setUser).catch(() => localStorage.removeItem('homelink_token')).finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
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

  const refreshUser = async () => {
    const data = await api.get('/auth/me');
    setUser(data);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyTwoFactor, register, loginWithGoogle, logout, updateProfile, refreshUser, setTwoFactorEnabled, sendTwoFactorSetupCode }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
