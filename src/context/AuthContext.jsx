import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('dayscore_token') || null);
  const [loading, setLoading] = useState(true);

  // Validate token on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          // Invalid or expired token
          logout();
        }
      } catch (e) {
        console.warn('Auth check warning:', e);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [token]);

  const login = async (email, password) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('dayscore_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (name, email, password) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    localStorage.setItem('dayscore_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('dayscore_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
