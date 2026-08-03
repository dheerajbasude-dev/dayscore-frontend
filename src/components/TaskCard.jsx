import React, { useState, useEffect } from 'react';
import { X, Loader2, Check, AlertTriangle, Clock, FileText, Save } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTimer } from '../hooks/useTimer';

export default function TaskCard({
  index,
  task,
  onStatusChange,
  onDelete,
  onRequestComplete,
  onClaimReward,
  onAcceptPenalty,
  isDeleting,
  animDelay = 0,
  isToday = true,
  onSaveDailyNote
}) {
  const { timeLeft, urgencyClass, isOverdue } = useTimer(task.dueDateTime);
  const [claiming, setClaiming] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const notesArr = Array.isArray(task.dailyNotes)
    ? task.dailyNotes
    : (Array.isArray(task.daily_notes) ? task.daily_notes : []);

  const getLatestNoteText = (arr) => {
    if (!arr || arr.length === 0) {
      if (typeof task.dailyNotes === 'string') return task.dailyNotes;
      if (typeof task.daily_notes === 'string') return task.daily_notes;
      return '';
    }
    const last = arr[arr.length - 1];
    return typeof last === 'string' ? last : (last?.note || '');
  };

  const [existingNote, setExistingNote] = useState(() => getLatestNoteText(notesArr));
  const [noteText, setNoteText] = useState(() => getLatestNoteText(notesArr));
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    const freshNote = getLatestNoteText(notesArr);
    setExistingNote(freshNote);
    if (!isEditingNote) {
      setNoteText(freshNote);
    }
  }, [task.dailyNotes, task.daily_notes]);

  const handleSaveNote = async (e) => {
    if (e) e.stopPropagation();
    if (savingNote || !onSaveDailyNote) return;
    setSavingNote(true);
    try {
      const todayDateStr = format(new Date(), 'yyyy-MM-dd');
      const cleanNoteText = noteText.trim();
      const updatedNotes = [
        ...notesArr.filter(n => n && typeof n === 'object' && n.date !== todayDateStr),
        { date: todayDateStr, note: cleanNoteText, rating: task.rating || null, created_at: new Date().toISOString() }
      ];
      await onSaveDailyNote(task, updatedNotes);
      setExistingNote(cleanNoteText);
      setIsEditingNote(false);
    } catch (err) {
      console.error('Save daily note error:', err);
    } finally {
      setSavingNote(false);
    }
  };

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

        {/* Row 4: Carried Over Task Daily Rating Note Section */}
        {isCarriedOver && (
          <div className="carried-over-note-container" style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px dashed rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#a5b4fc', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <FileText size={13} color="#818cf8" /> Daily Rating Note
              </span>
              {isToday ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => { e.stopPropagation(); setIsEditingNote(!isEditingNote); }}
                  style={{ fontSize: '0.72rem', padding: '2px 8px', height: '22px', borderRadius: '4px', color: 'var(--text-secondary)' }}
                >
                  {existingNote ? (isEditingNote ? 'Cancel' : '✏️ Edit Note') : (isEditingNote ? 'Cancel' : '＋ Add Daily Note')}
                </button>
              ) : (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  (Read-only on past dates)
                </span>
              )}
            </div>

            {/* Editing Box vs Display */}
            {isEditingNote && isToday ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }} onClick={(e) => e.stopPropagation()}>
                <textarea
                  className="task-note-input"
                  placeholder="Add a daily progress note for this carried over task..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '0.78rem',
                    borderRadius: 'var(--radius-sm, 6px)',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    color: 'var(--text-primary)',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveNote}
                    disabled={savingNote}
                    style={{ fontSize: '0.72rem', padding: '3px 10px', height: '24px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {savingNote ? <Loader2 size={12} className="btn-spinner" /> : <Save size={12} />}
                    {savingNote ? 'Saving...' : 'Save Note'}
                  </button>
                </div>
              </div>
            ) : (
              existingNote ? (
                <div style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  padding: '6px 10px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  marginTop: '2px'
                }}>
                  {existingNote}
                </div>
              ) : (
                !isEditingNote && isToday && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                    No daily note added yet. Click "+ Add Daily Note" above to reflect on today's progress.
                  </span>
                )
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
