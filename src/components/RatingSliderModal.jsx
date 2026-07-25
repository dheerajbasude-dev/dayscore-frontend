import React, { useState, useMemo, useEffect } from 'react';
import { X, Clock, AlertTriangle, Star } from 'lucide-react';
import { parseISO, isAfter } from 'date-fns';

export default function RatingSliderModal({ task, onConfirm, onCancel }) {
  if (!task) return null;

  const isOverdue = useMemo(() => {
    if (!task.dueDateTime) return false;
    try {
      const due = parseISO(task.dueDateTime);
      if (isNaN(due.getTime())) return false;
      return isAfter(new Date(), due);
    } catch {
      return new Date() > new Date(task.dueDateTime);
    }
  }, [task.dueDateTime]);

  const maxRating = isOverdue ? 3 : 10;
  const [rating, setRating] = useState(Math.ceil(maxRating / 2));

  // Reset rating default when task or maxRating changes
  useEffect(() => {
    setRating(Math.ceil(maxRating / 2));
  }, [maxRating, task.id]);

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
            <span>Completed on time — rate your effort (0 to max <strong>10</strong>)</span>
          </div>
        )}

        <div className="rating-display">
          <span className="rating-emoji">{getEmoji()}</span>
          <span className="rating-value" style={{ color: getSliderColor() }}>
            {rating}
          </span>
          <span className="rating-max">/ {maxRating}</span>
        </div>

        <div className="rating-slider-container">
          <span className="rating-slider-label-min">0</span>
          <div className="rating-slider-track-wrapper">
            <input
              type="range"
              min="0"
              max={maxRating}
              step="1"
              value={rating}
              onChange={e => setRating(Number(e.target.value))}
              className="rating-slider"
              style={{
                '--slider-percent': `${sliderPercent}%`,
                '--slider-color': getSliderColor()
              }}
            />
            <div className="rating-slider-ticks">
              {Array.from({ length: maxRating + 1 }).map((_, i) => (
                <span
                  key={i}
                  className={`rating-tick ${i <= rating ? 'active' : ''}`}
                  style={{ left: `${(i / maxRating) * 100}%` }}
                />
              ))}
            </div>
          </div>
          <span className="rating-slider-label-max">{maxRating}</span>
        </div>

        <div className="rating-stars">
          {Array.from({ length: maxRating }).map((_, i) => (
            <Star
              key={i}
              size={isOverdue ? 24 : 18}
              className={`rating-star ${i < rating ? 'filled' : ''}`}
              onClick={() => setRating(i + 1)}
              fill={i < rating ? getSliderColor() : 'none'}
              stroke={i < rating ? getSliderColor() : 'var(--text-muted)'}
            />
          ))}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onConfirm(task.id, rating, maxRating)}
          >
            Complete Task
          </button>
        </div>
      </div>
    </div>
  );
}

