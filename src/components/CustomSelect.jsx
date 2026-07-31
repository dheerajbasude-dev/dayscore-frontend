import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  style = {},
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find(o => String(o.value) === String(value)) || options[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '9px 12px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-tertiary)',
          border: isOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
          color: '#ffffff',
          fontSize: '0.85rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: isOpen ? '0 0 12px rgba(99, 102, 241, 0.3)' : 'none'
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={15}
          color="var(--text-muted)"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, marginLeft: '6px' }}
        />
      </button>

      {/* Floating Glassmorphic Menu */}
      {isOpen && (
        <div
          className="animate-pop-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 99999,
            background: '#121426',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            borderRadius: '12px',
            padding: '6px',
            maxHeight: '220px',
            overflowY: 'auto',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px'
          }}
        >
          {options.map((opt, idx) => {
            if (opt.disabled) {
              return (
                <div key={opt.value || `header_${idx}`} style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, padding: '6px 10px', textTransform: 'uppercase' }}>
                  {opt.label}
                </div>
              );
            }
            const isSel = String(opt.value) === String(value);

            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: isSel ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'rgba(255, 255, 255, 0.03)',
                  color: isSel ? '#ffffff' : '#f8fafc',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  fontWeight: isSel ? 700 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{opt.label}</span>
                {isSel && <Check size={14} color="#ffffff" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
