import React, { useState } from 'react';
import { X, Loader2, Check, AlertTriangle, Clock, FileText, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTimer } from '../hooks/useTimer';

export default function TaskCard({
  index,
  task,
  isToday = true,
  onStatusChange,
  onDelete,
  onRequestComplete,
  onClaimReward,
  onAcceptPenalty,
  onAddDailyNote,
  isDeleting,
  animDelay = 0
}) {
  const { timeLeft, urgencyClass, isOverdue } = useTimer(task.dueDateTime);
  const [claiming, setClaiming] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  const handleClaim = async (e) => {
    e.stopPropagation();
    if (claiming || !onClaimReward) return;
    setClaiming(true);
    try {
      await onClaimReward(task);
    } finally {
      setClaiming(false);
    }
  };

  const handleAccept = async (e) => {
    e.stopPropagation();
    if (accepting || !onAcceptPenalty) return;
    setAccepting(true);
    try {
      await onAcceptPenalty(task);
    } finally {
      setAccepting(false);
    }
  };

  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || submittingNote || !onAddDailyNote || !isToday || isDone || isMissed) return;
    setSubmittingNote(true);
    try {
      await onAddDailyNote(task, newNoteText.trim());
      setNewNoteText('');
    } catch (err) {
      console.error('Add daily note error:', err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const cycleStatus = () => {
    // Once a task is completed or missed, it cannot be completed or edited
    if (task.status === 'done' || task.status === 'missed') return;

    if (task.status === 'pending' || task.status === 'inprogress') {
      if (onRequestComplete) {
        onRequestComplete(task);
      } else {
        onStatusChange(task, 'done');
      }
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
  const getStartDateISO = () => {
    if (task.createdAt || task.created_at) return task.createdAt || task.created_at;
    if (task.date) return `${task.date}T00:00:00`;
    return null;
  };

  const createdFormatted = formatDateSafe(getStartDateISO());
  const completedFormatted = formatDateSafe(task.completedAt || task.completed_at);
  const dueFormatted = formatDateSafe(task.dueDateTime || task.due_date_time);
  const isDone = task.status === 'done';
  const isMissed = task.status === 'missed';
  const isCarriedOver = Boolean(task.carriedOver || task.carried_over || task.originalDate || task.original_date);
  const origDateDisplay = task.originalDate || task.original_date;

  const notesList = Array.isArray(task.daily_notes || task.dailyNotes)
    ? (task.daily_notes || task.dailyNotes)
    : [];

  const isRewardClaimed = task.rewardClaimed === true || task.rewardClaimed === 1 || task.rewardClaimed === '1' ||
                    task.reward_claimed === true || task.reward_claimed === 1 || task.reward_claimed === '1';
  const isPenaltyAccepted = task.penaltyAccepted === true || task.penaltyAccepted === 1 || task.penaltyAccepted === '1' ||
                     task.penalty_accepted === true || task.penalty_accepted === 1 || task.penalty_accepted === '1';

  const hasUnclaimedReward = Boolean(task.reward && !isRewardClaimed);
  const hasUnacknowledgedPenalty = Boolean(task.penalty && !isPenaltyAccepted);
  const hasPendingAction = hasUnclaimedReward || hasUnacknowledgedPenalty;

  return (
    <div 
      className={`task-card ${task.status} ${hasPendingAction ? 'has-pending-action' : ''} ${isDeleting ? 'task-exit' : 'task-enter'}`}
      style={{ animationDelay: isDeleting ? '0s' : `${animDelay}s` }}
    >
      {/* Checkbox */}
      <div
        className={`task-checkbox ${getCheckboxClass()} ${isDone || isMissed ? 'locked' : ''}`}
        onClick={cycleStatus}
        title={isDone ? 'Task completed' : isMissed ? 'Task missed (cannot be completed or edited)' : 'Mark as done'}
        style={{ cursor: isDone || isMissed ? 'not-allowed' : 'pointer' }}
      >
        {isDone && <Check size={14} strokeWidth={3} />}
        {isMissed && '✕'}
        {task.status === 'inprogress' && '⟳'}
      </div>

      {/* Content */}
      <div className="task-info">
        {/* Row 1: Title + Status + Delete */}
        <div className="task-header-row">
          <div className="task-title-group">
            {index !== undefined && index !== null && (
              <span className="task-index-num" title={`Task #${index}`}>
                #{index}
              </span>
            )}
            <span className={`task-title ${isDone && !hasPendingAction ? 'strikethrough' : ''}`}>
              {task.title}
            </span>
          </div>
          <div className="task-actions-right">
            <div className={`countdown ${urgencyClass}`}>
              {isDone ? <span className="text-success">✓ Done</span> : 
               isMissed ? <span className="text-danger">Missed</span> :
               timeLeft}
            </div>
            <button className="delete-btn" onClick={() => onDelete(task)} title="Delete Task">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Row 2: Meta badges + dates inline */}
        <div className="task-meta-row">
          <span className={`badge badge-${task.category.toLowerCase()}`}>{task.category}</span>
          <span className="meta-dot">·</span>
          <span className={`priority-text priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
          {ratingDisplay && (
            <>
              <span className="meta-dot">·</span>
              <span className={`rating-badge ${getRatingBadgeClass()}`}>
                ★ {task.rating}/{maxR}
              </span>
            </>
          )}
          {(createdFormatted || dueFormatted) && (
            <>
              <span className="meta-dot">·</span>
              <span className="task-dates-inline">
                {createdFormatted ? <span>{createdFormatted}</span> : <span>{task.date || 'Today'}</span>}
                {dueFormatted && (
                  <>
                    <span className="dates-arrow">→</span>
                    <span className={isMissed ? 'task-date-missed' : 'task-date-due'}>
                      {dueFormatted}
                    </span>
                  </>
                )}
              </span>
            </>
          )}
          {completedFormatted && isDone && (
            <>
              <span className="meta-dot">·</span>
              <span className="task-date-completed">✔ {completedFormatted}</span>
            </>
          )}
          {isCarriedOver && (
            <>
              <span className="meta-dot">·</span>
              <span style={{
                fontSize: '0.72rem',
                color: 'rgba(255, 255, 255, 0.45)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}>
                🔄 Carried
              </span>
            </>
          )}
        </div>

        {/* Row 3: Reward / Penalty */}
        {isDone && (task.reward || task.penalty) && (
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
                        className={`badge-action-btn badge-action-success ${claiming ? 'btn-loading' : ''}`}
                        onClick={handleClaim}
                        disabled={claiming}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        {claiming ? (
                          <>
                            <Loader2 size={12} className="btn-spinner" /> Saving...
                          </>
                        ) : (
                          'Claim'
                        )}
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
                        className={`badge-action-btn badge-action-danger ${accepting ? 'btn-loading' : ''}`}
                        onClick={handleAccept}
                        disabled={accepting}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        {accepting ? (
                          <>
                            <Loader2 size={12} className="btn-spinner" /> Saving...
                          </>
                        ) : (
                          'Acknowledge'
                        )}
                      </button>
                    )
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Row 4: Daily Notes Section (Only show if notes exist OR if active on Today) */}
        {((notesList && notesList.length > 0) || (isToday && !isDone && !isMissed)) && (
          <div className="task-daily-notes-container" style={{
            marginTop: '6px',
            padding: '6px 10px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: notesList.length > 0 ? '4px' : '2px' }}>
              <FileText size={12} style={{ color: 'var(--accent-primary)', opacity: 0.8 }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Daily Notes {notesList.length > 0 && `(${notesList.length})`}
              </span>
            </div>

            {/* Existing Notes List */}
            {notesList.length > 0 && (
              <div className="daily-notes-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: (isToday && !isDone && !isMissed) ? '6px' : '0' }}>
                {notesList.map((n, idx) => (
                  <div key={n.id || idx} className="daily-note-chip" style={{
                    fontSize: '0.74rem',
                    padding: '3px 7px',
                    borderRadius: '5px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)',
                    lineHeight: '1.3'
                  }}>
                    <span style={{
                      fontWeight: 600,
                      color: '#a5b4fc',
                      marginRight: '5px',
                      fontSize: '0.68rem',
                      opacity: 0.85
                    }}>
                      {n.date || 'Today'}:
                    </span>
                    <span>{n.note || n.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Note Input Form: ONLY WORKS ON TODAY'S DATE & WHEN TASK IS ACTIVE */}
            {isToday && !isDone && !isMissed && (
              <form onSubmit={handleNoteSubmit} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                <input
                  type="text"
                  placeholder="Add progress note..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  style={{
                    flex: 1,
                    height: '26px',
                    fontSize: '0.74rem',
                    padding: '3px 8px',
                    borderRadius: '5px',
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={submittingNote || !newNoteText.trim()}
                  className="btn btn-primary btn-sm"
                  style={{
                    height: '26px',
                    padding: '2px 8px',
                    fontSize: '0.7rem',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    opacity: (!newNoteText.trim() || submittingNote) ? 0.5 : 1
                  }}
                >
                  {submittingNote ? <Loader2 size={11} className="btn-spinner" /> : <Plus size={12} />}
                  <span>Add Note</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
