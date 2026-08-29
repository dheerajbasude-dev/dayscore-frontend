import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, AlertTriangle, X } from 'lucide-react';

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

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} color="#34d399" />;
      case 'warning':
        return <AlertTriangle size={18} color="#fbbf24" />;
      case 'error':
      default:
        return <AlertCircle size={18} color="#f87171" />;
    }
  };

  const getBorderColor = (type) => {
    switch (type) {
      case 'success':
        return 'rgba(52, 211, 153, 0.45)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.45)';
      case 'error':
      default:
        return 'rgba(239, 68, 68, 0.55)';
    }
  };

  const getIconBg = (type) => {
    switch (type) {
      case 'success':
        return 'rgba(52, 211, 153, 0.15)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.18)';
      case 'error':
      default:
        return 'rgba(239, 68, 68, 0.18)';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && createPortal(
        <div 
          className="responsive-toast-notification animate-fade-in"
          style={{
            borderColor: getBorderColor(toast.type),
            boxShadow: toast.type === 'error' 
              ? '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(239, 68, 68, 0.25)'
              : '0 16px 40px rgba(0, 0, 0, 0.75), 0 0 25px rgba(245, 158, 11, 0.25)'
          }}
          role="alert"
        >
          <div className="toast-icon-wrapper" style={{ background: getIconBg(toast.type), borderColor: getBorderColor(toast.type) }}>
            {getIcon(toast.type)}
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
      )}
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
