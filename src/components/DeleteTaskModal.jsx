import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, Trash2, Loader2, Check } from 'lucide-react';

export default function DeleteTaskModal({ isOpen = true, task, onClose, onConfirmDelete, isDeleting = false }) {
  const [confirmInput, setConfirmInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      setConfirmInput('');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isOpen]);

  if (!isOpen || !task) return null;

  const isConfirmEnabled = confirmInput.trim().toLowerCase() === 'delete';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isConfirmEnabled || isDeleting) return;
    await onConfirmDelete(task);
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 999999 }}>
      <div 
        className="modal-content animate-pop-in" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          maxWidth: '460px', 
          width: '92%',
          background: 'linear-gradient(145deg, #13172b 0%, #0d101d 100%)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(239, 68, 68, 0.15)',
          borderRadius: '20px',
          padding: '24px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.18)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle size={20} color="#f87171" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Delete Task
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                This action cannot be undone
              </span>
            </div>
          </div>
          <button 
            type="button"
            className="btn-icon" 
            onClick={onClose} 
            disabled={isDeleting}
            aria-label="Close modal"
            style={{ borderRadius: '50%', padding: '6px', background: 'var(--bg-glass-light)', border: '1px solid var(--border-glass)' }}
          >
            <X size={18} color="var(--text-muted)" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit}>
          {/* Target Task Card Preview */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px dashed rgba(239, 68, 68, 0.3)',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px'
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Target Task
              </span>
              <h4 style={{ margin: '2px 0 0 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {task.title}
              </h4>
            </div>
            <span className={`badge badge-${(task.category || 'work').toLowerCase()}`} style={{ fontSize: '0.68rem', padding: '2px 7px', flexShrink: 0 }}>
              {task.category || 'Work'}
            </span>
          </div>

          {/* Confirmation Prompt */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '8px' }}>
              Type <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 7px', borderRadius: '6px', fontFamily: 'monospace', fontWeight: 800 }}>delete</span> to confirm:
            </label>
            <input
              type="text"
              className="input"
              value={confirmInput}
              onChange={e => setConfirmInput(e.target.value)}
              placeholder='Type "delete" here...'
              disabled={isDeleting}
              autoFocus
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '10px',
                background: 'var(--bg-primary)',
                border: isConfirmEnabled ? '1px solid var(--accent-danger)' : '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                fontWeight: 600,
                outline: 'none',
                boxShadow: isConfirmEnabled ? '0 0 14px rgba(239, 68, 68, 0.35)' : 'none',
                transition: 'all 0.2s ease'
              }}
            />
          </div>

          {/* Footer Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '22px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isDeleting}
              style={{ padding: '9px 18px', borderRadius: '10px', fontSize: '0.86rem', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isConfirmEnabled || isDeleting}
              style={{
                padding: '9px 20px',
                borderRadius: '10px',
                fontSize: '0.86rem',
                fontWeight: 700,
                color: '#ffffff',
                border: isConfirmEnabled ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid transparent',
                background: isConfirmEnabled 
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                  : 'var(--bg-glass-light)',
                cursor: (isConfirmEnabled && !isDeleting) ? 'pointer' : 'not-allowed',
                opacity: (isConfirmEnabled && !isDeleting) ? 1 : 0.45,
                boxShadow: isConfirmEnabled ? '0 4px 16px rgba(239, 68, 68, 0.4)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              {isDeleting ? (
                <>
                  <Loader2 size={16} className="btn-spinner" style={{ color: '#ffffff' }} />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={15} />
                  Confirm Delete
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
