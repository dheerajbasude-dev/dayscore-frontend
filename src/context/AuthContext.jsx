import React, { createContext, useContext, useState, useEffect } from 'react';
import { getApiBaseUrl, safeJsonParse } from '../utils/api';
import { clearTaskMemoryCache, clearLocalUserData } from '../store/store';
import { unsubscribePushNotifications, subscribeToPushNotifications } from '../utils/pushManager';

const AuthContext = createContext(null);

const getUserFromToken = (tokenStr) => {
  if (!tokenStr) return null;
  try {
    const base64Url = tokenStr.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const parsed = JSON.parse(jsonPayload);
    if (parsed.exp && parsed.exp * 1000 < Date.now()) {
      return null;
    }
    return { id: parsed.id, name: parsed.name || 'User', email: parsed.email || '' };
  } catch (e) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('dayscore_token') || null);
  const [user, setUser] = useState(() => getUserFromToken(localStorage.getItem('dayscore_token')));
  const [loading, setLoading] = useState(true);

  // Validate token on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      const tokenUser = getUserFromToken(token);
      if (!tokenUser) {
        logout();
        setLoading(false);
        return;
      }

      setUser(tokenUser);

      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await safeJsonParse(res);
          if (data.user) {
            setUser(prev => ({
              ...data.user,
              name: data.user.name && data.user.name !== 'DayScore User' ? data.user.name : (tokenUser?.name || prev?.name || 'User'),
              email: data.user.email && !data.user.email.endsWith('@user.dayscore') ? data.user.email : (tokenUser?.email || prev?.email || '')
            }));
          }
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
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await safeJsonParse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    clearTaskMemoryCache();
    localStorage.setItem('dayscore_token', data.token);
    setToken(data.token);
    setUser(data.user);

    // Re-subscribe device for authenticated user if notification permission is granted
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      subscribeToPushNotifications(true).catch(e => {
        console.warn('Auto re-subscribe push after login note:', e);
      });
    }

    return data.user;
  };

  const register = async (name, email, password) => {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    const data = await safeJsonParse(res);
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    clearTaskMemoryCache();
    localStorage.setItem('dayscore_token', data.token);
    setToken(data.token);
    setUser(data.user);

    // Re-subscribe device for authenticated user if notification permission is granted
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      subscribeToPushNotifications(true).catch(e => {
        console.warn('Auto re-subscribe push after register note:', e);
      });
    }

    return data.user;
  };

  // Multi-tab logout listener
  useEffect(() => {
    let bc = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('dayscore_auth_sync');
        bc.onmessage = (event) => {
          if (event.data && event.data.type === 'LOGOUT') {
            try {
              unsubscribePushNotifications();
            } catch (e) {}
            clearLocalUserData();
            localStorage.removeItem('dayscore_token');
            setToken(null);
            setUser(null);
          }
        };
      }
    } catch (e) {}
    return () => {
      if (bc) try { bc.close(); } catch (e) {}
    };
  }, []);

  const logout = () => {
    const currentUserId = user?.id || getUserFromToken(token)?.id;

    // 1. Synchronous, guaranteed purge of local authentication and cached state
    try {
      localStorage.removeItem('dayscore_token');
    } catch (e) {}

    clearLocalUserData(currentUserId);
    setToken(null);
    setUser(null);

    // 2. Broadcast logout across all browser tabs immediately
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('dayscore_auth_sync');
        bc.postMessage({ type: 'LOGOUT' });
        bc.close();
      }
    } catch (e) {}

    // 3. Detached non-blocking push unsubscription in background with strict 1s timeout
    (async () => {
      try {
        await Promise.race([
          unsubscribePushNotifications(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Push unsubscribe timeout')), 1000))
        ]);
      } catch (e) {
        console.warn('Background push unsubscribe note during logout:', e);
      }
    })();
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
