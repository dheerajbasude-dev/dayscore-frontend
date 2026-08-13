import React, { useState, useMemo } from 'react';
import { X, Loader2, Check, AlertTriangle, Clock, FileText, Plus, Star, RotateCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTimer } from '../hooks/useTimer';

export const getRatingTheme = (val) => {
  const num = Number(val);
  if (isNaN(num) || num <= 4.0) {
    return {
      color: '#f87171',
      bg: 'rgba(248, 113, 113, 0.16)',
      border: 'rgba(248, 113, 113, 0.35)',
      activeBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      shadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
    };
  } else if (num <= 8.5) {
    return {
      color: '#60a5fa',
      bg: 'rgba(96, 165, 250, 0.16)',
      border: 'rgba(96, 165, 250, 0.35)',
      activeBg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      shadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
    };
  } else {
    return {
      color: '#34d399',
      bg: 'rgba(52, 211, 153, 0.16)',
      border: 'rgba(52, 211, 153, 0.35)',
      activeBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      shadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
    };
  }
};

function TaskCard({
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
  onShowToast,
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
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isJustCompleted, setIsJustCompleted] = useState(false);

  if (task.isOptimistic) {
    return (
      <div
        className="task-card card-glass animate-slide-up"
        style={{
          border: '1px solid rgba(99, 102, 241, 0.45)',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%)',
          boxShadow: '0 8px 24px rgba(99, 102, 241, 0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '14px 18px',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '12px',
          animation: 'optimisticPulse 1.8s ease-in-out infinite'
        }}
      >
        <div style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          border: '2px solid rgba(99, 102, 241, 0.5)',
          background: 'rgba(99, 102, 241, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Loader2 size={14} className="btn-spinner" style={{ color: 'var(--accent-primary)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {task.title}
            </span>
            <span className="badge badge-pri" style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
              Adding...
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Syncing task...
          </span>
        </div>
      </div>
    );
  }

  const notesList = Array.isArray(task.daily_notes || task.dailyNotes)
    ? (task.daily_notes || task.dailyNotes)
    : [];

  const todayDateStr = format(new Date(), 'yyyy-MM-dd');

  // Compute effective notes list including auto-missed days (0 rating) for past days
  const effectiveNotesList = useMemo(() => {
    const isMissedTask = task.status === 'missed' || task.missed === true;
    const isCarriedTask = Boolean(
      task.carriedOver ||
      task.carried_over ||
      task.wasCarried ||
      task.isCarried ||
      task.originalDate ||
      task.original_date
    );

    const dates = [];
    const createdIso = task.createdAt || task.created_at;
    if (createdIso) {
      const d = String(createdIso).split('T')[0];
      if (d && d.length >= 10) dates.push(d.substring(0, 10));
    }
    const orig = task.originalDate || task.original_date;
    if (orig) {
      const d = String(orig).split('T')[0];
      if (d && d.length >= 10) dates.push(d.substring(0, 10));
    }
    if (task.date) {
      const d = String(task.date).split('T')[0];
      if (d && d.length >= 10) dates.push(d.substring(0, 10));
    }
    dates.sort();
    const cleanStartStr = dates.length > 0 ? dates[0] : todayDateStr;

    const existingDates = new Set(
      notesList.map(n => n && n.date ? String(n.date).split('T')[0] : '')
    );

    const filled = [...notesList];

    try {
      const startDate = parseISO(cleanStartStr);
      
      let maxEndStr = todayDateStr;
      const dueIso = task.dueDateTime || task.due_date_time;
      if (dueIso) {
        try {
          const dueObj = typeof dueIso === 'string' ? parseISO(dueIso) : new Date(dueIso);
          const dueStr = format(dueObj, 'yyyy-MM-dd');
          if (dueStr < maxEndStr) {
            maxEndStr = dueStr;
          }
        } catch (e) {}
      } else if (task.date && (task.status === 'missed' || task.status === 'done')) {
        const taskDateClean = String(task.date).split('T')[0];
        if (taskDateClean < maxEndStr) {
          maxEndStr = taskDateClean;
        }
      }

      const endDate = parseISO(maxEndStr);
      const todayDate = parseISO(todayDateStr);

      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate <= endDate) {
        let curr = new Date(startDate);
        while (curr <= endDate && curr <= todayDate) {
          const currStr = format(curr, 'yyyy-MM-dd');
          if (currStr < todayDateStr && !existingDates.has(currStr)) {
            filled.push({
              id: `missed-${currStr}`,
              date: currStr,
              note: '',
              rating: 0,
              isAutoMissed: true
            });
          }
          curr.setDate(curr.getDate() + 1);
        }
      }
    } catch (e) {
      console.error('Error computing missed dates:', e);
    }

    return filled.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [notesList, task, todayDateStr]);

  const hasNoteForToday = useMemo(() => {
    if (!notesList || notesList.length === 0) return false;
    return notesList.some(n => {
      if (!n || !n.date) return false;
      return String(n.date).split('T')[0] === todayDateStr;
    });
  }, [notesList, todayDateStr]);

  const handleClaimReward = async () => {
    if (!onClaimReward || claiming) return;
    setClaiming(true);
    try {
      await onClaimReward(task);
    } finally {
      setClaiming(false);
    }
  };

  const handleAcceptPenalty = async () => {
    if (!onAcceptPenalty || accepting) return;
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



  const getCheckboxClass = () => {
    if (isMissed) return 'missed-check';
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

  const effectiveRating = useMemo(() => {
    if (!effectiveNotesList || effectiveNotesList.length === 0) {
      return task.rating != null ? Number(task.rating) : null;
    }
    let sum = 0;
    let hasUserRating = false;
    effectiveNotesList.forEach(n => {
      if (!n) return;
      const r = parseFloat(n.rating != null ? n.rating : 0);
      if (!isNaN(r) && r > 0 && !n.isAutoMissed) {
        sum += r;
        hasUserRating = true;
      }
    });
    if (!hasUserRating) {
      return task.rating != null ? Number(task.rating) : null;
    }
    const totalDaysCount = effectiveNotesList.length;
    return Math.round((sum / totalDaysCount) * 10) / 10;
  }, [effectiveNotesList, task.rating]);

  const displayRatingVal = effectiveRating != null ? effectiveRating : (task.rating != null ? Number(task.rating) : null);

  const getRatingBadgeClass = () => {
    const num = Number(displayRatingVal != null ? displayRatingVal : task.rating);
    if (isNaN(num) || num <= 4.0) return 'rating-badge-low';
    if (num <= 8.5) return 'rating-badge-medium';
    return 'rating-badge-high';
  };

  const maxR = task.maxRating || task.max_rating || 10;
  const ratingDisplay = task.status === 'done' && displayRatingVal != null;
  const getStartDateISO = () => {
    if (task.createdAt || task.created_at) return task.createdAt || task.created_at;
    if (task.date) return `${task.date}T00:00:00`;
    return null;
  };

  const createdFormatted = formatDateSafe(getStartDateISO());
  const completedFormatted = formatDateSafe(task.completedAt || task.completed_at);
  const dueFormatted = formatDateSafe(task.dueDateTime || task.due_date_time);
  const taskCreatedDateStr = useMemo(() => {
    if (task.createdAt) return typeof task.createdAt === 'string' ? task.createdAt.substring(0, 10) : '';
    if (task.created_at) return typeof task.created_at === 'string' ? task.created_at.substring(0, 10) : '';
    return '';
  }, [task.createdAt, task.created_at]);

  const targetDateCompareStr = useMemo(() => {
    if (task.date && typeof task.date === 'string' && task.date.length >= 10) {
      return task.date.trim().substring(0, 10);
    }
    return todayDateStr;
  }, [task.date, todayDateStr]);

  const hasRatingNote = useMemo(() => {
    const list = Array.isArray(task.daily_notes || task.dailyNotes || task.notes)
      ? (task.daily_notes || task.dailyNotes || task.notes)
      : [];
    return list.some(n => n && n.rating != null && Number(n.rating) > 0 && !n.isAutoMissed);
  }, [task.daily_notes, task.dailyNotes, task.notes]);

  const isDone = task.status === 'done' || (isOverdue && hasRatingNote);

  const isMissed = useMemo(() => {
    if (isDone || hasRatingNote) return false;
    if (task.status === 'missed' || task.missed === true || task.wasMissed === true || task.was_missed === true) {
      return true;
    }
    if (isOverdue) return true;
    return false;
  }, [isDone, hasRatingNote, task.status, task.missed, task.wasMissed, task.was_missed, isOverdue]);

  const isCarriedOver = useMemo(() => {
    if (!task) return false;

    const dueIso = task.dueDateTime || task.due_date_time;
    const orig = task.originalDate || task.original_date;
    const origDate = orig ? (typeof orig === 'string' ? orig.trim().substring(0, 10) : '') : '';
    const createdDate = taskCreatedDateStr || '';
    const viewDate = task.date ? (typeof task.date === 'string' ? task.date.trim().substring(0, 10) : '') : todayDateStr;

    let dueDateStr = '';
    if (dueIso) {
      try {
        const d = typeof dueIso === 'string' ? parseISO(dueIso) : new Date(dueIso);
        dueDateStr = format(d, 'yyyy-MM-dd');
      } catch (e) {}
    }

    const startDateStr = origDate || createdDate || viewDate;

    // Single-day tasks created and due on the same day are NOT carried tasks
    if (startDateStr && dueDateStr && startDateStr === dueDateStr && !Boolean(task.carriedOver || task.carried_over || task.wasCarried || task.isCarried)) {
      return false;
    }

    if (Boolean(task.carriedOver || task.carried_over || task.wasCarried || task.isCarried)) {
      return true;
    }

    if (origDate && viewDate && origDate < viewDate) return true;
    if (createdDate && viewDate && createdDate < viewDate) return true;

    return false;
  }, [task, taskCreatedDateStr, todayDateStr]);

  const checkExtendsBeyondToday = () => {
    if (isCarriedOver) return true;
    const dueIso = task.dueDateTime || task.due_date_time;
    if (!dueIso) return false;
    try {
      const d = typeof dueIso === 'string' ? parseISO(dueIso) : new Date(dueIso);
      const dueDateStr = format(d, 'yyyy-MM-dd');

      const orig = task.originalDate || task.original_date;
      const origDate = orig ? (typeof orig === 'string' ? orig.trim().substring(0, 10) : '') : '';
      const createdDate = taskCreatedDateStr || '';
      const viewDate = task.date ? (typeof task.date === 'string' ? task.date.trim().substring(0, 10) : '') : todayDateStr;
      const startDateStr = origDate || createdDate || viewDate;

      // If start date and due date are the exact same day, it is a single-day task
      if (startDateStr && dueDateStr && startDateStr === dueDateStr) {
        return false;
      }

      return dueDateStr > startDateStr;
    } catch (e) {
      return false;
    }
  };

  const isMultiDayOrCarried = checkExtendsBeyondToday();

  const isRewardClaimed = task.rewardClaimed === true || task.rewardClaimed === 1 || task.rewardClaimed === '1' ||
                    task.reward_claimed === true || task.reward_claimed === 1 || task.reward_claimed === '1';
  const isPenaltyAccepted = task.penaltyAccepted === true || task.penaltyAccepted === 1 || task.penaltyAccepted === '1' ||
                     task.penalty_accepted === true || task.penalty_accepted === 1 || task.penalty_accepted === '1';

  const ratingNum = task.rating != null && !isNaN(Number(task.rating)) ? Number(task.rating) : null;
  const hasLowRatingPenalty = (isDone || isMissed) && (ratingNum == null || ratingNum <= 4.0);
  const hasHighRatingReward = isDone && (ratingNum == null || ratingNum > 4.0);

  const hasReward = Boolean(task.reward && hasHighRatingReward);
  const hasPenalty = Boolean((task.penalty || (isMissed && (ratingDisplay || !isToday))) && (isMissed || hasLowRatingPenalty));

  const hasUnclaimedReward = Boolean(hasReward && !isRewardClaimed);
  const hasUnacknowledgedPenalty = Boolean(hasPenalty && !isPenaltyAccepted);

  const isCheckboxLocked = isDone || (isMissed && !isToday);

  const isFutureDueTask = useMemo(() => {
    if (isDone) return false;
    const dueIso = task.dueDateTime || task.due_date_time;
    if (dueIso) {
      try {
        const dueObj = typeof dueIso === 'string' ? parseISO(dueIso) : new Date(dueIso);
        const dueDateStr = format(dueObj, 'yyyy-MM-dd');
        if (dueDateStr > todayDateStr) return true;
      } catch (e) {}
    }
    return false;
  }, [isDone, task.dueDateTime, task.due_date_time, todayDateStr]);

  const cycleStatus = async () => {
    if (task.status === 'done' || isUpdatingStatus || isFutureDueTask) return;

    // On older/past dates (not Today), silently return without showing toast!
    if (!isToday) return;

    const isMultiDayTaskOrCarried = checkExtendsBeyondToday();

    if (isMultiDayTaskOrCarried) {
      // If user hasn't submitted today's daily progress note & rating yet, show toast!
      if (!hasNoteForToday) {
        if (onShowToast) {
          onShowToast("Please submit today's progress note & rating before marking as completed!");
        }
        return;
      }

      // If user HAS submitted today's daily progress note & rating:
      // AUTOMATICALLY COMPLETE the task based on task rating notes averages (WITHOUT opening rating modal!)
      if (onAutoCompleteWithRating) {
        const listToUse = effectiveNotesList && effectiveNotesList.length > 0 ? effectiveNotesList : notesList;
        let sumRating = 0;
        let hasRated = false;
        listToUse.forEach(n => {
          if (!n) return;
          const r = parseFloat(n.rating != null ? n.rating : (n.score != null ? n.score : 0));
          if (!isNaN(r) && r > 0 && !n.isAutoMissed) {
            sumRating += r;
            hasRated = true;
          }
        });

        // Denominator includes ALL daily note entries (user rated days + missed 0-rating days)
        const count = listToUse.length || 1;
        const computedAvg = hasRated ? Math.round((sumRating / count) * 10) / 10 : 8.0;

        setIsUpdatingStatus(true);
        try {
          await onAutoCompleteWithRating(task, computedAvg);
          setIsJustCompleted(true);
          setTimeout(() => setIsJustCompleted(false), 2500);
        } catch (err) {
          console.error('Auto completion error:', err);
        } finally {
          setIsUpdatingStatus(false);
        }
        return;
      }
    }

    // Standard single-day tasks: open rating slider modal
    if (onRequestComplete) {
      onRequestComplete(task);
      return;
    }
  };

  const wasOriginallyMissed = Boolean(
    task.wasMissed || 
    task.was_missed || 
    task.wasMissedTask || 
    (task.status === 'done' && (maxR === 3 || task.maxRating === 3 || task.max_rating === 3))
  );

  const currentTheme = getRatingTheme(dailyRating);
  const isTransitioningState = isUpdatingStatus;
  const effectiveCardStatus = isDone ? 'done' : (isMissed ? 'missed' : task.status);

  return (
    <div 
      id={`task-card-${task.id || task._id}`}
      className={`task-card ${effectiveCardStatus} ${isTransitioningState ? 'transitioning-card' : ''} ${isJustCompleted ? 'just-completed-highlight' : ''} ${(hasUnclaimedReward || hasUnacknowledgedPenalty) ? 'has-pending-action' : ''} ${isDeleting ? 'task-exit' : 'task-enter'}`}
      style={{ animationDelay: isDeleting ? '0s' : `${animDelay}s` }}
    >
      {!isFutureDueTask && !(isMissed && !isToday) && (
        isTransitioningState ? (
          <div 
            className="task-checkbox-loader-container"
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              border: '2px solid rgba(99, 102, 241, 0.6)',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(79, 70, 229, 0.2))',
              boxShadow: '0 0 14px rgba(99, 102, 241, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              alignSelf: 'center',
              animation: 'optimisticPulse 1.8s ease-in-out infinite'
            }}
          >
            <Loader2 size={14} className="btn-spinner" style={{ color: '#6366f1' }} />
          </div>
        ) : (
          <div
            className={`task-checkbox ${getCheckboxClass()} ${isCheckboxLocked ? 'locked' : ''}`}
            onClick={cycleStatus}
            title={
              isDone 
                ? 'Task completed' 
                : isMissed 
                  ? (isToday ? 'Rate missed task effort (0-3 range)' : 'Missed task on overred day (score 0)') 
                  : 'Mark as done'
            }
            style={{ cursor: isCheckboxLocked ? 'not-allowed' : 'pointer' }}
          >
            {isDone && <Check size={14} strokeWidth={3} />}
            {task.status === 'inprogress' && '⟳'}
          </div>
        )
      )}

      <div className="task-info">
        <div className="task-header-row">
          <div className="task-title-group">
            {index !== undefined && index !== null && (
              <span className="task-index-num" title={`Task #${index}`}>
                #{index}
              </span>
            )}
            {isCarriedOver && (
              <span className="carried-over-blinking-badge" title={`Carried over from ${task.originalDate || task.original_date || taskCreatedDateStr || 'previous date'}`}>
                <RotateCcw size={11} className="carried-icon-spin-subtle" />
              </span>
            )}
            <span className={`task-title ${isDone ? 'strikethrough' : ''}`}>
              {task.title}
            </span>
          </div>
          <div className="task-actions-right">
            {(isMultiDayOrCarried && (effectiveNotesList.length > 0 || (isToday && !isDone && !isMissed))) && (
              <button
                type="button"
                className={`task-note-toggle-btn ${showNotesInput ? 'active' : ''} ${effectiveNotesList.length > 0 ? 'has-notes' : ''}`}
                onClick={() => setShowNotesInput(prev => !prev)}
                title={showNotesInput ? "Hide Daily Notes" : "View / Add Daily Notes"}
              >
                <FileText size={14} />
                {effectiveNotesList.length > 0 && <span>{effectiveNotesList.length}</span>}
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
          {ratingDisplay ? (
            <>
              <span className="meta-dot">·</span>
              <span className={`rating-badge ${getRatingBadgeClass()}`}>★ {displayRatingVal}/{maxR}</span>
            </>
          ) : (isMissed && !isToday) ? (
            <>
              <span className="meta-dot">·</span>
              <span className="rating-badge rating-badge-low zero-score-badge-anim" title="Overred missed task final score: 0">
                ★ 0
              </span>
            </>
          ) : null}
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

        {hasReward && (
          <div className="action-banner banner-reward">
            <span className="banner-text">🎁 Reward: {task.reward}</span>
            {isRewardClaimed ? (
              <button className="btn btn-sm btn-success claimed" disabled>
                ✓ Claimed
              </button>
            ) : (
              <button 
                className="btn btn-sm btn-success" 
                onClick={handleClaimReward}
                disabled={claiming}
              >
                {claiming ? <Loader2 size={13} className="btn-spinner" /> : 'Claim'}
              </button>
            )}
          </div>
        )}

        {hasPenalty && (
          <div className="action-banner banner-penalty">
            <span className="banner-text">⚠️ Penalty: {task.penalty || "Complete 15-min focus reflection / workout"}</span>
            {isPenaltyAccepted ? (
              <button className="btn btn-sm btn-secondary acknowledged" disabled>
                ✓ Acknowledged
              </button>
            ) : (
              <button 
                className="btn btn-sm btn-secondary" 
                onClick={handleAcceptPenalty}
                disabled={accepting}
              >
                {accepting ? <Loader2 size={13} className="btn-spinner" /> : 'Acknowledge'}
              </button>
            )}
          </div>
        )}

        {showNotesInput && (
          <div className="daily-notes-container" style={{
            marginTop: '8px',
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.55)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            {effectiveNotesList.length > 0 && (
              <div className="daily-notes-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: (isToday && !isDone && !isMissed) ? '10px' : '0' }}>
                {effectiveNotesList.map((n, idx) => {
                  const ratingVal = n.rating != null && !isNaN(Number(n.rating)) ? Number(n.rating) : 0;
                  const itemTheme = getRatingTheme(ratingVal);
                  const isMissedDay = n.isAutoMissed || ratingVal === 0;

                  return (
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

                      {isMissedDay ? (
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          color: '#f87171',
                          flexShrink: 0
                        }}>
                          Missed
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: itemTheme.color,
                          background: itemTheme.bg,
                          border: `1px solid ${itemTheme.border}`,
                          borderRadius: '4px',
                          padding: '1px 6px',
                          flexShrink: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          ★ {ratingVal.toFixed(1)}
                        </span>
                      )}

                      <span style={{
                        wordBreak: 'break-word',
                        color: isMissedDay ? '#f87171' : 'var(--text-primary)',
                        fontStyle: isMissedDay ? 'italic' : 'normal'
                      }}>
                        {n.note || n.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {isToday && !isDone && !isMissed && (
              hasNoteForToday ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem',
                  color: '#34d399',
                  fontWeight: 600,
                  marginTop: effectiveNotesList.length > 0 ? '4px' : '0',
                  padding: '0 2px'
                }}>
                  <Check size={12} strokeWidth={2.5} style={{ color: '#34d399' }} />
                  <span>Today's note & rating submitted</span>
                </div>
              ) : (
                <form onSubmit={handleNoteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                      <FileText size={13} style={{ position: 'absolute', left: '10px', color: 'rgba(148, 163, 184, 0.6)', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        placeholder="Add daily progress note..."
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

                    <button
                      type="submit"
                      disabled={submittingNote || !newNoteText.trim()}
                      className="compact-note-save-btn"
                      title="Add Daily Note"
                      aria-label="Add Daily Note"
                      style={{
                        width: '34px',
                        height: '34px',
                        padding: '0',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        borderRadius: '8px',
                        background: newNoteText.trim() 
                          ? currentTheme.activeBg
                          : currentTheme.bg,
                        color: newNoteText.trim() ? '#ffffff' : currentTheme.color,
                        border: `1px solid ${currentTheme.border}`,
                        boxShadow: newNoteText.trim() ? currentTheme.shadow : 'none',
                        opacity: newNoteText.trim() ? 1 : 0.65,
                        cursor: newNoteText.trim() && !submittingNote ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease-in-out',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {submittingNote ? <Loader2 size={15} className="btn-spinner" /> : <Plus size={16} strokeWidth={2.5} />}
                    </button>
                  </div>

                  {/* Sleek Interactive 10-Segment Color-Coded Rating Selector */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                    background: 'rgba(10, 13, 22, 0.4)',
                    padding: '4px 8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: currentTheme.color,
                        padding: '0 6px',
                        height: '22px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '3px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        borderRadius: '5px',
                        background: currentTheme.bg,
                        border: `1px solid ${currentTheme.border}`
                      }}>
                        ★ {dailyRating.toFixed(1)}
                      </span>
                    </div>

                    {/* 1 to 10 Quick Tap Pill Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', overflowX: 'auto', padding: '2px 0' }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => {
                        const btnTheme = getRatingTheme(val);
                        const isSelected = Math.floor(dailyRating) === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setDailyRating(val)}
                            style={{
                              width: '22px',
                              height: '22px',
                              padding: 0,
                              borderRadius: '5px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              border: isSelected ? `1px solid ${btnTheme.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                              background: isSelected ? btnTheme.activeBg : 'rgba(255, 255, 255, 0.04)',
                              color: isSelected ? '#ffffff' : btnTheme.color,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            title={`Rate ${val}.0`}
                          >
                            {val}
                          </button>
                        );
                      })}

                      {/* +0.5 Half Step Toggle Pill */}
                      <button
                        type="button"
                        onClick={() => setDailyRating(prev => {
                          const base = Math.floor(prev);
                          const hasHalf = prev % 1 !== 0;
                          return hasHalf ? base : Math.min(10, base + 0.5);
                        })}
                        style={{
                          height: '22px',
                          padding: '0 5px',
                          borderRadius: '5px',
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          border: dailyRating % 1 !== 0 ? `1px solid ${currentTheme.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                          background: dailyRating % 1 !== 0 ? currentTheme.bg : 'rgba(255, 255, 255, 0.04)',
                          color: dailyRating % 1 !== 0 ? currentTheme.color : 'var(--text-muted)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        title="Toggle +0.5 half star rating"
                      >
                        .5
                      </button>
                    </div>
                  </div>
                </form>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(TaskCard);
