import React from 'react';
import { X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTimer } from '../hooks/useTimer';

export default function TaskCard({ task, onStatusChange, onDelete, onRequestComplete, onClaimReward, onAcceptPenalty }) {
  const { timeLeft, urgencyClass, isOverdue } = useTimer(task.dueDateTime);

  const cycleStatus = () => {
    if (task.status === 'pending' || task.status === 'inprogress' || task.status === 'missed') {
      if (onRequestComplete) {
        onRequestComplete(task);
      } else {
        onStatusChange(task.id, 'done');
      }
    } else if (task.status === 'done') {
      onStatusChange(task.id, 'pending');
    }
  };

  const getCheckboxClass = () => {
    switch (task.status) {
      case 'inprogress': return 'half-filled';
      case 'done': return 'checked';
      case 'missed': return 'missed-check';
      default: return 'empty';
    }
  };

  const formatDateSafe = (isoStr) => {
    if (!isoStr) return null;
    try {
      const d = typeof isoStr === 'string' ? parseISO(isoStr) : new Date(isoStr);
      return format(d, 'MMM dd, h:mm a');
    } catch (e) {
      return null;
    }
  };

  const getRatingBadgeClass = () => {
    const num = Number(task.rating);
    if (num <= 4) return 'rating-badge-low';
    if (num <= 8) return 'rating-badge-medium';
    return 'rating-badge-high';
  };

  const maxR = task.maxRating || task.max_rating || 10;
  const ratingDisplay = task.status === 'done' && task.rating != null;
  const createdFormatted = formatDateSafe(task.createdAt || task.created_at);
  const completedFormatted = formatDateSafe(task.completedAt || task.completed_at);

  return (
    <div className={`task-card ${task.status} animate-slide-up`}>
      <div className={`task-checkbox ${getCheckboxClass()}`} onClick={cycleStatus}>
        {task.status === 'done' && '✓'}
        {task.status === 'missed' && '✕'}
        {task.status === 'inprogress' && '⟳'}
      </div>

      <div className="task-info">
        <div className="task-header-row">
          <div className={`task-title ${task.status === 'done' ? 'strikethrough' : ''}`}>
            {task.title}
          </div>
          <div className="task-actions-right">
            <div className={`countdown ${urgencyClass}`}>
              {task.status === 'done' ? <span className="text-success">✓ Done</span> : 
               task.status === 'missed' ? <span className="text-danger">Missed</span> :
               timeLeft}
            </div>
            <button className="delete-btn" onClick={() => onDelete(task.id)} title="Delete Task">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="task-meta">
          <span className={`badge badge-${task.category.toLowerCase()}`}>{task.category}</span>
          <span className={`priority-text priority-${task.priority.toLowerCase()}`}>{task.priority} Priority</span>
          {task.carriedOver && <span className="carried-badge">↻ Carried Over</span>}
          {ratingDisplay && (
            <span className={`rating-badge ${getRatingBadgeClass()}`}>
              ★ {task.rating}/{maxR}
            </span>
          )}
          {createdFormatted && (
            <span className="task-date-badge">
              📅 Created: {createdFormatted}
            </span>
          )}
          {completedFormatted && task.status === 'done' && (
            <span className="task-date-badge task-date-completed">
              ✓ Completed: {completedFormatted}
            </span>
          )}
        </div>

        {task.status === 'done' && (task.reward || task.penalty) && (
          <div className="task-reward-row">
            {task.reward && (() => {
              const isClaimed = task.rewardClaimed === true || task.rewardClaimed === 1 || task.rewardClaimed === '1' ||
                                task.reward_claimed === true || task.reward_claimed === 1 || task.reward_claimed === '1';
              return (
                <div className={`reward-badge-task ${isClaimed ? 'badge-status-claimed' : ''}`}>
                  <span className="reward-badge-text">🎁 Reward: {task.reward}</span>
                  {isClaimed ? (
                    <span className="claimed-tag">✓ Claimed</span>
                  ) : (
                    onClaimReward && (
                      <button 
                        className="badge-action-btn badge-action-success"
                        onClick={(e) => { e.stopPropagation(); onClaimReward(task.id || task._id); }}
                      >
                        Claim
                      </button>
                    )
                  )}
                </div>
              );
            })()}
            {task.penalty && (() => {
              const isAccepted = task.penaltyAccepted === true || task.penaltyAccepted === 1 || task.penaltyAccepted === '1' ||
                                 task.penalty_accepted === true || task.penalty_accepted === 1 || task.penalty_accepted === '1';
              return (
                <div className={`penalty-badge-task ${isAccepted ? 'badge-status-claimed' : ''}`}>
                  <span className="penalty-badge-text">⚠️ Penalty: {task.penalty}</span>
                  {isAccepted ? (
                    <span className="accepted-tag">✓ Acknowledged</span>
                  ) : (
                    onAcceptPenalty && (
                      <button 
                        className="badge-action-btn badge-action-danger"
                        onClick={(e) => { e.stopPropagation(); onAcceptPenalty(task.id || task._id); }}
                      >
                        Acknowledge
                      </button>
                    )
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
