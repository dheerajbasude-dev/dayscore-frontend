import React, { useState, useMemo, useEffect } from 'react';
import { X, Clock, AlertTriangle, Star, Loader2 } from 'lucide-react';
import { parseISO, isAfter } from 'date-fns';

export default function RatingSliderModal({ task, onConfirm, onCancel }) {
  if (!task) return null;

  const [submitting, setSubmitting] = useState(false);

  const isOverdue = useMemo(() => {
    if (!task.dueDateTime && !task.due_date_time) return false;
    const dateVal = task.dueDateTime || task.due_date_time;
    try {
      const due = parseISO(dateVal);
      if (isNaN(due.getTime())) return false;
      return isAfter(new Date(), due);
    } catch {
      return new Date() > new Date(dateVal);
    }
  }, [task.dueDateTime, task.due_date_time]);

  const maxRating = isOverdue ? 3 : 10;
  const [rating, setRating] = useState(maxRating === 3 ? 1.5 : 5.0);

  // Reset rating default when task or maxRating changes
  useEffect(() => {
    setRating(maxRating === 3 ? 1.5 : 5.0);
    setSubmitting(false);
  }, [maxRating, task.id, task._id]);

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

  const getSliderColor = () => {
    if (isOverdue) {
      const ratio = rating / maxRating;
      if (ratio <= 0.33) return 'var(--accent-danger)';
      if (ratio <= 0.66) return 'var(--accent-warning)';
      return 'var(--accent-warning)';
    }
    const ratio = rating / maxRating;
    if (ratio <= 0.3) return 'var(--accent-danger)';
    if (ratio <= 0.6) return 'var(--accent-warning)';
    return 'var(--accent-success)';
  };

  const getEmoji = () => {
    if (isOverdue) {
      if (rating <= 1) return '😔';
      if (rating <= 2) return '😐';
      return '🙂';
    }
    if (rating <= 2) return '😔';
    if (rating <= 4) return '😐';
    if (rating <= 6) return '🙂';
    if (rating <= 8) return '😊';
    return '🤩';
  };

  const sliderPercent = maxRating > 0 ? (rating / maxRating) * 100 : 0;

  const presets = useMemo(() => {
    const list = [];
    for (let v = 0.5; v <= maxRating; v += 0.5) {
      list.push(v);
    }
    return list;
  }, [maxRating]);

  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 1; i <= maxRating; i++) {
      let fillState = 'empty';
      if (i <= fullStars) {
        fillState = 'full';
      } else if (i === fullStars + 1 && hasHalfStar) {
        fillState = 'half';
      }

      stars.push(
        <div 
          key={i} 
          className="star-wrapper"
          onClick={() => setRating(i)}
          style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}
          title={`Rate ${i}`}
        >
          {fillState === 'half' ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Star size={isOverdue ? 26 : 20} stroke="var(--text-muted)" fill="none" />
              <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', overflow: 'hidden' }}>
                <Star size={isOverdue ? 26 : 20} stroke={getSliderColor()} fill={getSliderColor()} />
              </div>
            </div>
          ) : (
            <Star
              size={isOverdue ? 26 : 20}
              fill={fillState === 'full' ? getSliderColor() : 'none'}
              stroke={fillState === 'full' ? getSliderColor() : 'var(--text-muted)'}
            />
          )}
        </div>
      );
    }
    return stars;
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content rating-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Rate Your Completion Effort</h2>
          <button className="btn-icon" onClick={onCancel} aria-label="Close">
            <X size={20} />
          </button>
        </div>

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
            <span>Completed on time — rate effort (0 to max <strong>10</strong> in 0.5 steps)</span>
          </div>
        )}

        <div className="rating-display">
          <span className="rating-emoji">{getEmoji()}</span>
          <span className="rating-value" style={{ color: getSliderColor() }}>
            {rating % 1 === 0 ? rating.toFixed(0) : rating.toFixed(1)}
          </span>
          <span className="rating-max">/ {maxRating}</span>
        </div>

        {/* Preset Pills Row */}
        <div 
          className="rating-presets-row" 
          style={{ 
            display: 'flex', 
            gap: '6px', 
            overflowX: 'auto', 
            padding: '6px 2px', 
            margin: '8px 0',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {presets.map(val => (
            <button
              key={val}
              type="button"
              className={`preset-pill ${rating === val ? 'active' : ''}`}
              onClick={() => setRating(val)}
              style={{
                padding: '4px 10px',
                borderRadius: '14px',
                fontSize: '0.8rem',
                fontWeight: '600',
                border: '1px solid ' + (rating === val ? getSliderColor() : 'var(--border-glass)'),
                background: rating === val ? getSliderColor() : 'var(--bg-glass-light)',
                color: rating === val ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s ease'
              }}
            >
              {val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}
            </button>
          ))}
        </div>

        <div className="rating-slider-container">
          <span className="rating-slider-label-min">0</span>
          <div className="rating-slider-track-wrapper">
            <input
              type="range"
              min="0"
              max={maxRating}
              step="0.5"
              value={rating}
              onChange={e => setRating(Number(e.target.value))}
              className="rating-slider"
              style={{
                '--slider-percent': `${sliderPercent}%`,
                '--slider-color': getSliderColor()
              }}
            />
            <div className="rating-slider-ticks">
              {Array.from({ length: maxRating * 2 + 1 }).map((_, i) => {
                const val = i * 0.5;
                const isWhole = val % 1 === 0;
                return (
                  <span
                    key={i}
                    className={`rating-tick ${val <= rating ? 'active' : ''} ${isWhole ? 'tick-whole' : 'tick-half'}`}
                    style={{ 
                      left: `${(val / maxRating) * 100}%`,
                      height: isWhole ? '8px' : '4px',
                      opacity: isWhole ? 0.9 : 0.4
                    }}
                  />
                );
              })}
            </div>
          </div>
          <span className="rating-slider-label-max">{maxRating}</span>
        </div>

        <div className="rating-stars">
          {renderStars()}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn btn-primary ${submitting ? 'btn-loading' : ''}`}
            onClick={handleConfirm}
            disabled={submitting}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
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
    </div>
  );
}

