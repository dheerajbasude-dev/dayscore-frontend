import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarCheck, BarChart3, Gift, Settings, Sun, Moon, User, LogOut, LogIn } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

export default function Navigation() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <>
      <header className="mobile-topbar">
        <div className="mobile-logo">
          <span className="logo-icon">◉</span> DayScore
        </div>
        <div className="mobile-topbar-actions">
          {user ? (
            <button className="user-profile-badge" onClick={() => setShowAuthModal(true)} title={`Logged in as ${user.name}`}>
              <div className="user-avatar-small">{user.name.charAt(0).toUpperCase()}</div>
            </button>
          ) : (
            <button className="btn-icon mobile-auth-btn" onClick={() => setShowAuthModal(true)} title="Sign In">
              <LogIn size={18} />
            </button>
          )}
          <button onClick={toggleTheme} className="mobile-theme-toggle" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <nav className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">◉</span> DayScore
        </div>

        {user ? (
          <div className="sidebar-user-card">
            <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-email">{user.email}</span>
            </div>
            <button className="btn-icon user-logout-btn" onClick={logout} title="Sign Out">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="sidebar-auth-cta" onClick={() => setShowAuthModal(true)}>
            <div className="auth-cta-icon"><User size={18} /></div>
            <div className="auth-cta-text">
              <strong>Sign In / Register</strong>
              <span>Save & sync your data</span>
            </div>
          </div>
        )}

        <div className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <CalendarCheck size={20} />
            <span>Today</span>
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <BarChart3 size={20} />
            <span>Analytics</span>
          </NavLink>
          <NavLink to="/rewards" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Gift size={20} />
            <span>Rewards</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Settings size={20} />
            <span>Settings</span>
          </NavLink>
        </div>
        <div className="sidebar-footer">
          <button onClick={toggleTheme} className="theme-toggle">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </nav>

      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <CalendarCheck size={20} />
          <span>Today</span>
        </NavLink>
        <NavLink to="/analytics" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <BarChart3 size={20} />
          <span>Analytics</span>
        </NavLink>
        <NavLink to="/rewards" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Gift size={20} />
          <span>Rewards</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Settings size={20} />
          <span>Settings</span>
        </NavLink>
      </nav>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
