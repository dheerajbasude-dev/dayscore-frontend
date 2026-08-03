import React, { useState, useMemo } from 'react';
import { X, Loader2, Check, AlertTriangle, Clock, FileText, Plus, Star } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTimer } from '../hooks/useTimer';

export default function TaskCard({
  index,
  task,
  isToday = true,
  onStatusChange,
  onDelete,
  onRequestComplete,
  onAutoCompleteWithRating,
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
  const [dailyRating, setDailyRating] = useState(8.0);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [showNotesInput, setShowNotesInput] = useState(false);

  const notesList = Array.isArray(task.daily_notes || task.dailyNotes)
    ? (task.daily_notes || task.dailyNotes)
    : [];

  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const hasNoteForToday = useMemo(() => {
    if (!notesList || notesList.length === 0) return false;
    return notesList.some(n => {
      if (!n || !n.date) return false;
      return String(n.date).split('T')[0] === todayDateStr;
    });
  }, [notesList, todayDateStr]);

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
    if (!newNoteText.trim() || submittingNote || !onAddDailyNote || !isToday || isDone || isMissed || hasNoteForToday) return;
    setSubmittingNote(true);
    try {
      await onAddDailyNote(task, newNoteText.trim(), dailyRating);
      setNewNoteText('');
      setShowNotesInput(false);
    } catch (err) {
      console.error('Add daily note error:', err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const cycleStatus = () => {
    if (task.status === 'done') return;

    if (task.status === 'missed') {
      if (!isToday) return;
      if (onRequestComplete) {
        onRequestComplete(task);
      }
      return;
    }

    if (task.status === 'pending' || task.status === 'inprogress') {
      const notesWithRating = notesList.filter(n => n && n.rating != null && !isNaN(Number(n.rating)));
      if (notesWithRating.length > 0) {
        const totalRating = notesWithRating.reduce((sum, n) => sum + Number(n.rating), 0);
        const calculatedAvg = Number((totalRating / notesWithRating.length).toFixed(1));
        if (onAutoCompleteWithRating) {
          onAutoCompleteWithRating(task, calculatedAvg);
          return;
        }
      }

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

  const formatNoteDate = (isoStr) => {
    if (!isoStr) return 'Today';
    try {
      const d = typeof isoStr === 'string' ? parseISO(isoStr) : new Date(isoStr);
      return format(d, 'MMM dd, yyyy');
    } catch (e) {
      return 'Today';
    }
  };

  const formatOrigDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
      return format(d, 'MMM dd, yyyy');
    } catch (e) {
      return dateStr;
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
  const origDateFormatted = formatOrigDate(origDateDisplay);

  const checkExtendsBeyondToday = () => {
    if (isCarriedOver) return true;
    if (notesList && notesList.length > 0) return true;
    const dueIso = task.dueDateTime || task.due_date_time;
    if (!dueIso) return false;
    try {
      const d = typeof dueIso === 'string' ? parseISO(dueIso) : new Date(dueIso);
      const dueDateStr = format(d, 'yyyy-MM-dd');
      return dueDateStr > todayDateStr;
    } catch (e) {
      return false;
    }
  };

  const isMultiDayOrCarried = checkExtendsBeyondToday();

  const isRewardClaimed = task.rewardClaimed === true || task.rewardClaimed === 1 || task.rewardClaimed === '1' ||
                    task.reward_claimed === true || task.reward_claimed === 1 || task.reward_claimed === '1';
  const isPenaltyAccepted = task.penaltyAccepted === true || task.penaltyAccepted === 1 || task.penaltyAccepted === '1' ||
                     task.penalty_accepted === true || task.penalty_accepted === 1 || task.penalty_accepted === '1';

  const hasUnclaimedReward = Boolean(task.reward && !isRewardClaimed);
  const hasUnacknowledgedPenalty = Boolean(task.penalty && !isPenaltyAccepted);

  const isCheckboxLocked = isDone || (isMissed && !isToday);

  const wasOriginallyMissed = Boolean(
    task.wasMissed || 
    task.was_missed || 
    task.wasMissedTask || 
    (task.status === 'done' && (maxR === 3 || task.maxRating === 3 || task.max_rating === 3))
  );

  return (
    <div 
      className={`task-card ${task.status} ${(hasUnclaimedReward || hasUnacknowledgedPenalty) ? 'has-pending-action' : ''} ${isDeleting ? 'task-exit' : 'task-enter'}`}
      style={{ animationDelay: isDeleting ? '0s' : `${animDelay}s` }}
    >
      <div
        className={`task-checkbox ${getCheckboxClass()} ${isCheckboxLocked ? 'locked' : ''}`}
        onClick={cycleStatus}
        title={
          isDone 
            ? 'Task completed' 
            : isMissed 
              ? (isToday ? 'Mark missed task as done (max rating 3)' : 'Missed task on past date (cannot be modified)') 
              : 'Mark as done'
        }
        style={{ cursor: isCheckboxLocked ? 'not-allowed' : 'pointer' }}
      >
        {isDone && <Check size={14} strokeWidth={3} />}
        {isMissed && '✕'}
        {task.status === 'inprogress' && '⟳'}
      </div>

      <div className="task-info">
        <div className="task-header-row">
          <div className="task-title-group">
            {index !== undefined && index !== null && (
              <span className="task-index-num" title={`Task #${index}`}>
                #{index}
              </span>
            )}
            <span className={`task-title ${isDone ? 'strikethrough' : ''}`}>
              {task.title}
            </span>
          </div>
          <div className="task-actions-right">
            {(isMultiDayOrCarried && (notesList.length > 0 || (isToday && !isDone && !isMissed))) && (
              <button
                type="button"
                className={`task-note-toggle-btn ${showNotesInput ? 'active' : ''} ${notesList.length > 0 ? 'has-notes' : ''}`}
                onClick={() => setShowNotesInput(prev => !prev)}
                title={showNotesInput ? "Hide Daily Notes" : "View / Add Daily Notes"}
              >
                <FileText size={14} />
                {notesList.length > 0 && <span>{notesList.length}</span>}
              </button>
            )}
            <div className={`countdown ${urgencyClass}`}>
              {isDone ? (
                wasOriginallyMissed ? <span style={{ color: '#f87171' }}>✓ Late</span> : <span className="text-success">✓ Done</span>
              ) : isMissed ? <span className="text-danger">Missed</span> : timeLeft}
            </div>
            <button className="delete-btn" onClick={() => onDelete(task)} title="Delete Task"><X size={14} /></button>
          </div>
        </div>

        <div className="task-meta-row">
          <span className={`badge badge-${task.category.toLowerCase()}`}>{task.category}</span>
          <span className="meta-dot">·</span>
          <span className={`priority-text priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
          {ratingDisplay && (
            <>
              <span className="meta-dot">·</span>
              <span className={`rating-badge ${getRatingBadgeClass()}`}>★ {task.rating}/{maxR}</span>
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
                    <span className={isMissed ? 'task-date-missed' : 'task-date-due'}>{dueFormatted}</span>
                  </>
                )}
              </span>
            </>
          )}
          {completedFormatted && (
            <>
              <span className="meta-dot">·</span>
              <span className="task-date-completed">
                ✓ {completedFormatted}
              </span>
            </>
          )}
        </div>

        {hasUnclaimedReward && (
          <div className="action-banner banner-reward">
            <span className="banner-text">🎁 Reward: {task.reward}</span>
            <button 
              className="btn btn-sm btn-success" 
              onClick={handleClaim}
              disabled={claiming}
            >
              {claiming ? <Loader2 size={13} className="btn-spinner" /> : '✓ Claimed'}
            </button>
          </div>
        )}

        {hasUnacknowledgedPenalty && (
          <div className="action-banner banner-penalty">
            <span className="banner-text">⚠️ Penalty: {task.penalty}</span>
            <button 
              className="btn btn-sm btn-secondary" 
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? <Loader2 size={13} className="btn-spinner" /> : '✓ Acknowledged'}
            </button>
          </div>
        )}

        {showNotesInput && (
          <div className="daily-notes-container" style={{
            marginTop: '8px',
            padding: '8px 12px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            {notesList.length > 0 && (
              <div className="daily-notes-list" style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: (isToday && !isDone && !isMissed) ? '8px' : '0' }}>
                {notesList.map((n, idx) => (
                  <div key={n.id || idx} style={{
                    fontSize: '0.76rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'var(--text-primary)',
                    lineHeight: '1.4'
                  }}>
                    <span style={{
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      fontSize: '0.74rem',
                      flexShrink: 0
                    }}>
                      {formatNoteDate(n.date)}:
                    </span>
                    {n.rating != null && !isNaN(Number(n.rating)) && (
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: '#fbbf24',
                        background: 'rgba(251, 191, 36, 0.14)',
                        border: '1px solid rgba(251, 191, 36, 0.28)',
                        borderRadius: '4px',
                        padding: '1px 5px',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        ★ {Number(n.rating).toFixed(1)}
                      </span>
                    )}
                    <span style={{ wordBreak: 'break-word' }}>{n.note || n.text}</span>
                  </div>
                ))}
              </div>
            )}

            {isToday && !isDone && !isMissed && (
              hasNoteForToday ? (
                <div style={{
                  position: 'relative',
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  height: '34px',
                  fontSize: '0.78rem',
                  color: '#34d399',
                  fontWeight: 600
                }}>
                  <Check size={14} style={{ marginRight: '6px', flexShrink: 0, color: '#34d399' }} />
                  <span>Daily note & rating submitted for today ✓</span>
                </div>
              ) : (
                <form onSubmit={handleNoteSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: '180px', display: 'flex', alignItems: 'center' }}>
                    <FileText size={13} style={{ position: 'absolute', left: '10px', color: 'rgba(148, 163, 184, 0.6)', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      placeholder="Add a daily progress note..."
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      autoFocus
                      className="compact-note-input"
                      style={{
                        width: '100%',
                        height: '34px',
                        fontSize: '0.78rem',
                        padding: '4px 12px 4px 30px',
                        borderRadius: '8px',
                        background: 'rgba(10, 13, 22, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#f8fafc',
                        outline: 'none',
                        transition: 'all 0.2s ease-in-out'
                      }}
                    />
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(251, 191, 36, 0.12)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    borderRadius: '8px',
                    padding: '0 8px',
                    height: '34px',
                    flexShrink: 0
                  }} title="Daily Progress Rating (1-10)">
                    <Star size={13} fill="#fbbf24" stroke="#fbbf24" style={{ flexShrink: 0 }} />
                    <select
                      value={dailyRating}
                      onChange={(e) => setDailyRating(Number(e.target.value))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fbbf24',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      {[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4, 3, 2, 1].map(r => (
                        <option key={r} value={r} style={{ background: '#1e293b', color: '#f8fafc' }}>
                          ★ {r.toFixed(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingNote || !newNoteText.trim()}
                    className="compact-note-save-btn"
                    title="Save Daily Note & Rating"
                    aria-label="Save Daily Note & Rating"
                    style={{
                      height: '34px',
                      width: '34px',
                      padding: 0,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '50%',
                      background: newNoteText.trim() 
                        ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' 
                        : 'rgba(99, 102, 241, 0.18)',
                      color: newNoteText.trim() ? '#ffffff' : 'rgba(165, 180, 252, 0.5)',
                      border: newNoteText.trim()
                        ? '1px solid rgba(129, 140, 248, 0.4)'
                        : '1px solid rgba(99, 102, 241, 0.2)',
                      boxShadow: newNoteText.trim() ? '0 2px 10px rgba(99, 102, 241, 0.35)' : 'none',
                      cursor: newNoteText.trim() && !submittingNote ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s ease-in-out',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {submittingNote ? <Loader2 size={15} className="btn-spinner" /> : <Plus size={18} />}
                  </button>
                </form>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
