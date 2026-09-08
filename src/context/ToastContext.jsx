import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, AlertTriangle, X, RotateCcw, Gift, ShieldAlert } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'error') => {
    if (!message) return;
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast(current => (current && current.id === id ? null : current));
    }, 4500);
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const resolveToastType = (type, message = '') => {
    if (type === 'reward' || type === 'penalty') return type;
    const msg = String(message).toLowerCase();
    if (msg.includes('reward claimed') || msg.includes('reward claim')) {
      return 'reward';
    }
    if (msg.includes('penalty acknowledged') || msg.includes('penalty accept') || msg.includes('punishment acknowledged')) {
      return 'penalty';
    }
    return type;
  };

  const getIcon = (type) => {
    switch (type) {
      case 'reward':
        return <Gift size={18} color="#c084fc" />;
      case 'penalty':
        return <ShieldAlert size={18} color="#f87171" />;
      case 'success':
        return <CheckCircle2 size={18} color="#34d399" />;
      case 'warning':
        return <AlertTriangle size={18} color="#fbbf24" />;
      case 'info':
        return <RotateCcw size={18} color="#0AFFFF" className="carried-icon-spin-subtle" />;
      case 'error':
      default:
        return <AlertCircle size={18} color="#f87171" />;
    }
  };

  const getBorderColor = (type) => {
    switch (type) {
      case 'reward':
        return 'rgba(168, 85, 247, 0.55)';
      case 'penalty':
        return 'rgba(239, 68, 68, 0.55)';
      case 'success':
        return 'rgba(52, 211, 153, 0.45)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.45)';
      case 'info':
        return 'rgba(10, 255, 255, 0.45)';
      case 'error':
      default:
        return 'rgba(239, 68, 68, 0.55)';
    }
  };

  const getIconBg = (type) => {
    switch (type) {
      case 'reward':
        return 'rgba(168, 85, 247, 0.22)';
      case 'penalty':
        return 'rgba(239, 68, 68, 0.22)';
      case 'success':
        return 'rgba(52, 211, 153, 0.15)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.18)';
      case 'info':
        return 'rgba(10, 255, 255, 0.15)';
      case 'error':
      default:
        return 'rgba(239, 68, 68, 0.18)';
    }
  };

  const getBoxShadow = (type) => {
    switch (type) {
      case 'reward':
        return '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(168, 85, 247, 0.35)';
      case 'penalty':
        return '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(239, 68, 68, 0.35)';
      case 'error':
        return '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(239, 68, 68, 0.25)';
      case 'info':
        return '0 16px 40px rgba(0, 0, 0, 0.75), 0 0 25px rgba(10, 255, 255, 0.25)';
      case 'success':
        return '0 16px 40px rgba(0, 0, 0, 0.75), 0 0 25px rgba(52, 211, 153, 0.25)';
      default:
        return '0 16px 40px rgba(0, 0, 0, 0.75), 0 0 25px rgba(245, 158, 11, 0.25)';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && (() => {
        const resolvedType = resolveToastType(toast.type, toast.message);
        return createPortal(
          <div 
            className={`responsive-toast-notification animate-fade-in toast-${resolvedType}`}
            style={{
              borderColor: getBorderColor(resolvedType),
              boxShadow: getBoxShadow(resolvedType)
            }}
            role="alert"
          >
            <div 
              className="toast-icon-wrapper" 
              style={{ 
                background: getIconBg(resolvedType), 
                borderColor: getBorderColor(resolvedType),
                boxShadow: resolvedType === 'reward' 
                  ? '0 0 12px rgba(168, 85, 247, 0.35)' 
                  : resolvedType === 'penalty'
                    ? '0 0 12px rgba(239, 68, 68, 0.35)'
                    : undefined
              }}
            >
              {getIcon(resolvedType)}
            </div>
            <span style={{ flex: 1, color: '#f8fafc', fontWeight: 600, fontSize: '0.88rem' }}>
              {toast.message}
            </span>
            <button
              type="button"
              className="toast-close-btn"
              onClick={hideToast}
              aria-label="Close Notification"
            >
              <X size={16} />
            </button>
          </div>,
          document.body
        );
      })()}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast: (msg) => console.warn('Toast:', msg),
      hideToast: () => {}
    };
  }
  return context;
}
