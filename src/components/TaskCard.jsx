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
    if (!newNoteText.trim() || submittingNote || !onAddDailyNote || !isToday) return;
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
              <span className="carried-over-badge" style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '1px 7px',
                borderRadius: '4px',
                background: 'rgba(99, 102, 241, 0.18)',
                color: '#a5b4fc',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}>
                🔄 Carried Over {origDateDisplay ? `(from ${origDateDisplay})` : ''}
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

        {/* Row 4: Carried Over Daily Notes Section */}
        {(isCarriedOver || (notesList && notesList.length > 0)) && (
          <div className="task-daily-notes-container" style={{
            marginTop: '10px',
            padding: '8px 12px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 'var(--radius-sm, 8px)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: notesList.length > 0 ? '6px' : '4px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <FileText size={13} style={{ color: 'var(--accent-primary)' }} />
                Daily Progress Notes {notesList.length > 0 && `(${notesList.length})`}
              </span>
              {!isToday && (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  (Read-only on past dates)
                </span>
              )}
            </div>

            {/* Existing Notes List */}
            {notesList.length > 0 && (
              <div className="daily-notes-list" style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: (isToday && !isDone && !isMissed) ? '8px' : '0' }}>
                {notesList.map((n, idx) => (
                  <div key={n.id || idx} className="daily-note-chip" style={{
                    fontSize: '0.76rem',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    color: 'var(--text-primary)',
                    lineHeight: '1.3'
                  }}>
                    <span style={{
                      fontWeight: 700,
                      color: '#a5b4fc',
                      marginRight: '6px',
                      fontSize: '0.7rem',
                      background: 'rgba(99, 102, 241, 0.15)',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      border: '1px solid rgba(99, 102, 241, 0.25)'
                    }}>
                      Added on {n.date || 'Today'}
                    </span>
                    <span>{n.note || n.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Note Input Form: ONLY WORKS ON TODAY'S DATE & WHEN TASK IS ACTIVE */}
            {isToday && !isDone && !isMissed && (
              <form onSubmit={handleNoteSubmit} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <input
                  type="text"
                  placeholder="Add a daily progress note..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  style={{
                    flex: 1,
                    height: '30px',
                    fontSize: '0.78rem',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={submittingNote || !newNoteText.trim()}
                  className="btn btn-primary btn-sm"
                  style={{
                    height: '30px',
                    padding: '4px 10px',
                    fontSize: '0.74rem',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: (!newNoteText.trim() || submittingNote) ? 0.5 : 1
                  }}
                >
                  {submittingNote ? <Loader2 size={12} className="btn-spinner" /> : <Plus size={13} />}
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
