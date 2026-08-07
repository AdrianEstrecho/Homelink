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
    localStorage.setItem('homelink_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (form) => {
    const data = await api.post('/auth/register', form);
    localStorage.setItem('homelink_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const loginWithGoogle = async (credential, { mode } = {}) => {
    const data = await api.post('/auth/google', { credential, mode });
    localStorage.setItem('homelink_token', data.token);
    setUser(data.user);
    return data.user;
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
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, updateProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
