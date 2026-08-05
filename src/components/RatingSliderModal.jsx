import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, AlertTriangle, Star, Loader2 } from 'lucide-react';
import { parseISO, isAfter } from 'date-fns';

export default function RatingSliderModal({ task, onConfirm, onCancel }) {
  if (!task) return null;

  const [submitting, setSubmitting] = useState(false);

  const isOverdue = useMemo(() => {
    if (task.status === 'missed') return true;
    if (!task.dueDateTime && !task.due_date_time) return false;
    const dateVal = task.dueDateTime || task.due_date_time;
    try {
      const due = parseISO(dateVal);
      if (isNaN(due.getTime())) return false;
      return isAfter(new Date(), due);
    } catch {
      return new Date() > new Date(dateVal);
    }
  }, [task.status, task.dueDateTime, task.due_date_time]);

  const initialDefaultRating = useMemo(() => {
    if (isOverdue) return 1.5;
    const notes = Array.isArray(task.daily_notes || task.dailyNotes) ? (task.daily_notes || task.dailyNotes) : [];
    const rated = notes.filter(n => n && n.rating != null && !isNaN(Number(n.rating)) && Number(n.rating) > 0);
    if (rated.length > 0) {
      const avg = rated.reduce((s, n) => s + Number(n.rating), 0) / rated.length;
      return Math.round(avg * 10) / 10;
    }
    return 8.0;
  }, [isOverdue, task]);

  const [rating, setRating] = useState(initialDefaultRating);
  const [hoverRating, setHoverRating] = useState(null);

  // Reset rating default when task or maxRating changes
  useEffect(() => {
    setRating(initialDefaultRating);
    setHoverRating(null);
    setSubmitting(false);
  }, [initialDefaultRating, task.id, task._id]);

  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  const activeRating = hoverRating !== null ? hoverRating : rating;

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const targetId = task.id || task._id;
      await onConfirm(targetId, rating, maxRating);
    } catch (e) {
      console.error('Confirm rating error:', e);
      setSubmitting(false);
    }
  };

  const getRatingColor = (val) => {
    const currentVal = val !== undefined ? val : activeRating;
    if (isOverdue) {
      return '#f87171'; // Red color ONLY for overdue/missed tasks
    }
    if (currentVal <= 4) return '#f87171'; // Red (up to 4 stars)
    if (currentVal <= 8.5) return '#60a5fa'; // Blue (>4 and <=8.5 stars)
    return '#34d399'; // Green (remaining: >8.5 stars)
  };

  const getEmoji = (val) => {
    const currentVal = val !== undefined ? val : activeRating;
    if (isOverdue) {
      return '😔';
    }
    if (currentVal <= 2) return '😔';
    if (currentVal <= 4) return '😐';
    if (currentVal <= 6) return '🙂';
    if (currentVal <= 8) return '😊';
    return '🤩';
  };

  const starSize = isOverdue ? 36 : 28;

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content rating-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Rate Your Completion Effort</h2>
          <button className="btn-icon" onClick={onCancel} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-form-body">
          <div className="modal-form-scroll">
          <div className="rating-task-info">
            <span className="rating-task-title">{task.title}</span>
            <div className="rating-status-badge-row">
              <span className={`badge badge-${(task.category || 'work').toLowerCase()}`}>{task.category}</span>
              {isOverdue ? (
                <span className="rating-overdue-badge">
                  <AlertTriangle size={13} /> Overdue
                </span>
              ) : (
                <span className="rating-ontime-badge">
                  <Clock size={13} /> On Time
                </span>
              )}
            </div>
          </div>

          {isOverdue ? (
            <div className="rating-overdue-notice">
              <AlertTriangle size={16} />
              <span>Due datetime has passed — rating capped at max <strong>3</strong></span>
            </div>
          ) : (
            <div className="rating-ontime-notice">
              <Clock size={16} />
              <span>Click stars or 0.0 to rate effort (0 to <strong>10</strong>)</span>
            </div>
          )}

          <div className="rating-display" style={{ margin: '8px 0 4px 0' }}>
            <span className="rating-emoji">{getEmoji()}</span>
            <span className="rating-value" style={{ color: getRatingColor(), fontSize: '2.4rem', fontWeight: '800' }}>
              {activeRating % 1 === 0 ? activeRating.toFixed(0) : activeRating.toFixed(1)}
            </span>
            <span className="rating-max" style={{ fontSize: '1.2rem' }}>/ {maxRating}</span>
          </div>

          {/* Zero Effort Chip */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setRating(0)}
              onMouseEnter={() => setHoverRating(0)}
              style={{
                padding: '4px 12px',
                fontSize: '0.8rem',
                borderRadius: '20px',
                border: activeRating === 0 ? '1px solid #f87171' : '1px solid var(--border-glass)',
                background: activeRating === 0 ? 'rgba(248, 113, 113, 0.18)' : 'var(--bg-glass-light)',
                color: activeRating === 0 ? '#f87171' : 'var(--text-muted)',
                fontWeight: activeRating === 0 ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              0.0 (Zero Effort)
            </button>
          </div>

          {/* Pure Interactive 10-Star Rating Bar */}
          <div 
            className="star-rating-bar"
            onMouseLeave={() => setHoverRating(null)}
            style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: isOverdue ? '10px' : '4px', 
              padding: '8px 6px',
              background: 'var(--bg-glass-light)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-glass)',
              margin: '2px 0 4px 0',
              flexWrap: 'wrap'
            }}
          >
            {Array.from({ length: maxRating }).map((_, idx) => {
              const starNum = idx + 1;
              const isFull = starNum <= activeRating;
              const isHalf = starNum - 0.5 === activeRating;

              return (
                <div 
                  key={starNum}
                  style={{ 
                    position: 'relative', 
                    width: `${starSize}px`, 
                    height: `${starSize}px`, 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.15s ease',
                    transform: (isFull || isHalf) ? 'scale(1.08)' : 'scale(1)'
                  }}
                >
                  {/* Left Half Click/Hover Zone */}
                  <div 
                    style={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      width: '50%', 
                      height: '100%', 
                      zIndex: 10 
                    }}
                    onMouseEnter={() => setHoverRating(starNum - 0.5)}
                    onClick={() => setRating(starNum - 0.5)}
                    title={`Rate ${starNum - 0.5}`}
                  />

                  {/* Right Half Click/Hover Zone */}
                  <div 
                    style={{ 
                      position: 'absolute', 
                      top: 0, 
                      right: 0, 
                      width: '50%', 
                      height: '100%', 
                      zIndex: 10 
                    }}
                    onMouseEnter={() => setHoverRating(starNum)}
                    onClick={() => setRating(starNum)}
                    title={`Rate ${starNum}`}
                  />

                  {/* Star SVG Rendering */}
                  {isHalf ? (
                    <div style={{ position: 'relative', width: `${starSize}px`, height: `${starSize}px` }}>
                      <Star size={starSize} stroke="var(--text-muted)" fill="none" />
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', overflow: 'hidden' }}>
                        <Star size={starSize} stroke={getRatingColor()} fill={getRatingColor()} />
                      </div>
                    </div>
                  ) : (
                    <Star
                      size={starSize}
                      fill={isFull ? getRatingColor() : 'none'}
                      stroke={isFull ? getRatingColor() : 'var(--text-muted)'}
                      style={{ transition: 'all 0.2s ease' }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0' }}>
            💡 Click "<strong>0.0 (Zero Effort)</strong>" or click stars (half star <strong>0.5</strong>, full star <strong>1.0</strong>)
          </p>
        </div>
      </div>

      <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${isOverdue ? 'btn-danger' : 'btn-primary'} ${submitting ? 'btn-loading' : ''}`}
            onClick={handleConfirm}
            disabled={submitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: isOverdue ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : undefined,
              borderColor: isOverdue ? 'rgba(239, 68, 68, 0.4)' : undefined,
              boxShadow: isOverdue ? '0 4px 14px rgba(239, 68, 68, 0.4)' : undefined
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="btn-spinner" />
                <span>Saving Effort...</span>
              </>
            ) : (
              <span>Complete Task</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

