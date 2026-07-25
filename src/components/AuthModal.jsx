import React, { useState } from 'react';
import { X, LogIn, UserPlus, ShieldCheck, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isSignUp) {
        if (!name.trim()) throw new Error('Please enter your name.');
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setSubmitting(true);
    try {
      try {
        await register('Demo User', 'demo@dayscore.app', 'demo12345');
      } catch (e) {
        await login('demo@dayscore.app', 'demo12345');
      }
      onClose();
    } catch (err) {
      setError('Demo login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content auth-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="auth-modal-title">
            <span className="logo-icon">◉</span> {isSignUp ? 'Create DayScore Account' : 'Welcome Back'}
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <div className="segmented auth-segmented">
          <div 
            className={`segmented-option ${!isSignUp ? 'active' : ''}`}
            onClick={() => { setIsSignUp(false); setError(''); }}
          >
            <LogIn size={15} style={{ marginRight: 6 }} /> Sign In
          </div>
          <div 
            className={`segmented-option ${isSignUp ? 'active' : ''}`}
            onClick={() => { setIsSignUp(true); setError(''); }}
          >
            <UserPlus size={15} style={{ marginRight: 6 }} /> Sign Up
          </div>
        </div>

        {error && (
          <div className="auth-error-badge animate-slide-down">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {isSignUp && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-icon-wrapper">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  className="input input-with-icon" 
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-icon-wrapper">
              <Mail size={18} className="input-icon" />
              <input 
                type="email" 
                className="input input-with-icon" 
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-icon-wrapper">
              <Lock size={18} className="input-icon" />
              <input 
                type="password" 
                className="input input-with-icon" 
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="modal-footer auth-footer">
            <button 
              type="button" 
              className="btn btn-secondary btn-demo"
              onClick={handleDemoLogin}
              disabled={submitting}
            >
              🚀 Demo Account
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
