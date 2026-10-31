import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { CalendarCheck, BarChart3, Gift, Settings, Sun, Moon, User, LogOut, LogIn, Plus } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import { getLeaveBalance, fetchUserLeavesApi } from '../store/store';

import BrandLogo from './BrandLogo';

export default function Navigation() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState(() => getLeaveBalance());
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setLeaveBalance(getLeaveBalance());
    if (user) {
      fetchUserLeavesApi()
        .then(() => setLeaveBalance(getLeaveBalance()))
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    const handleLeavesUpdated = () => {
      setLeaveBalance(getLeaveBalance());
    };
    const handleLogout = () => {
      setLeaveBalance(getLeaveBalance());
    };
    window.addEventListener('dayscore_leaves_updated', handleLeavesUpdated);
    window.addEventListener('dayscore_user_logout', handleLogout);
    return () => {
      window.removeEventListener('dayscore_leaves_updated', handleLeavesUpdated);
      window.removeEventListener('dayscore_user_logout', handleLogout);
    };
  }, []);

  const handleLeaveClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      sessionStorage.setItem('dayscore_open_leave_modal', 'true');
    } catch {}

    if (location.pathname !== '/') {
      navigate('/', { state: { openLeaveModal: true } });
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-leave-modal'));
      }, 50);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-leave-modal'));
      }, 180);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-leave-modal'));
      }, 350);
    } else {
      window.dispatchEvent(new CustomEvent('open-leave-modal'));
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    setShowAuthModal(true);
  };

  const handleAddClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!user) {
      navigate('/');
      setShowAuthModal(true);
      return;
    }

    // Signal modal open in sessionStorage so TodayView will open it immediately upon mounting
    try {
      sessionStorage.setItem('dayscore_open_add_modal', 'true');
    } catch {}

    if (location.pathname !== '/') {
      navigate('/', { state: { openAddModal: true } });
      // Multi-interval event dispatch to guarantee delivery regardless of React mount delay
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-add-task-modal'));
      }, 50);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-add-task-modal'));
      }, 180);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-add-task-modal'));
      }, 350);
    } else {
      window.dispatchEvent(new CustomEvent('open-add-task-modal'));
    }
  };

  return (
    <>
      <header className="mobile-topbar">
        <div className="mobile-logo">
          <BrandLogo size="medium" />
        </div>
        <div className="mobile-topbar-actions">
          {/* Order: Leave status -> dark/light icon -> user profile */}
          <button
            type="button"
            className="leave-balance-pill mobile-leave-pill"
            onClick={handleLeaveClick}
            title="Annual Leave"
            aria-label="Annual Leave Balance"
          >
            {(leaveBalance?.used != null ? leaveBalance.used : 0)}/{leaveBalance?.total || 36}
          </button>
          <button onClick={toggleTheme} className="mobile-theme-toggle" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user ? (
            <button className="user-profile-badge" onClick={() => setShowAuthModal(true)} title={`Logged in as ${user.name}`}>
              <div className="user-avatar-small">{user.name.charAt(0).toUpperCase()}</div>
            </button>
          ) : (
            <button className="btn-icon mobile-auth-btn" onClick={() => setShowAuthModal(true)} title="Sign In">
              <LogIn size={18} />
            </button>
          )}
        </div>
      </header>

      <nav className="sidebar">
        <div className="sidebar-logo">
          <BrandLogo size="medium" />
        </div>

        <button
          type="button"
          className="leave-balance-pill sidebar-leave-pill"
          onClick={handleLeaveClick}
          title="Annual Leave"
          aria-label="Annual Leave Balance"
        >
          {(leaveBalance?.used != null ? leaveBalance.used : 0)}/{leaveBalance?.total || 36}
        </button>

        {user ? (
          <div className="sidebar-user-card">
            <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-email">{user.email}</span>
            </div>
            <button className="btn-icon user-logout-btn" onClick={handleLogout} title="Sign Out">
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
        <button 
          type="button" 
          className="bottom-nav-item bottom-nav-add-btn"
          onClick={handleAddClick}
          onTouchEnd={(e) => {
            handleAddClick(e);
          }}
          aria-label="Add Task"
          title="Add New Task"
        >
          <div className="bottom-nav-add-icon">
            <Plus size={18} />
          </div>
          <span>Add</span>
        </button>
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
