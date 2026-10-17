import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, AlertTriangle, X, Check, Loader2, Info, Clock, ShieldAlert } from 'lucide-react';
import { format, parseISO, addDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { getLocalDateStr } from '../utils/taskUtils';
import { getLeaveBalance, getUserLeaves, isDateOnLeave, applyUserLeaveApi } from '../store/store';
import { useAuth } from '../context/AuthContext';

export default function LeaveModal({
  isOpen = false,
  onClose,
  archives = [],
  todayTasks = [],
  onLeaveApplied
}) {
  const { user } = useAuth();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState('apply'); // 'apply' | 'history'

  const balance = getLeaveBalance();
  const leaveHistory = getUserLeaves();

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      setStartDate(todayStr);
      setEndDate(todayStr);
      setReason('');
      setErrorMessage('');
      setActiveTab('apply');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isOpen, todayStr]);

  // Helper: check if a date has any rated Task Note
  const getRatedTaskNoteDateInSelection = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;

    const checkTask = (t, checkDateStr) => {
      if (!t) return false;
      const notes = Array.isArray(t.daily_notes || t.dailyNotes || t.notes)
        ? (t.daily_notes || t.dailyNotes || t.notes)
        : [];
      return notes.some(n => {
        if (!n || !n.date) return false;
        const d = getLocalDateStr(n.date);
        const r = parseFloat(n.rating != null ? n.rating : (n.score != null ? n.score : 0));
        return d === checkDateStr && !isNaN(r) && r > 0 && !n.isAutoMissed;
      });
    };

    let curr = new Date(start);
    while (curr <= end) {
      const dStr = format(curr, 'yyyy-MM-dd');
      // Check in todayTasks
      if (Array.isArray(todayTasks) && todayTasks.some(t => checkTask(t, dStr))) {
        return dStr;
      }
      // Check in archives
      if (Array.isArray(archives)) {
        for (const arc of archives) {
          if (Array.isArray(arc?.tasks) && arc.tasks.some(t => checkTask(t, dStr))) {
            return dStr;
          }
        }
      }
      curr = addDays(curr, 1);
    }
    return null;
  }, [startDate, endDate, todayTasks, archives]);

  // Compute number of days requested and dates array
  const { requestedDaysCount, requestedDates, hasOverlap, hasPastDate } = useMemo(() => {
    if (!startDate || !endDate) {
      return { requestedDaysCount: 0, requestedDates: [], hasOverlap: false, hasPastDate: false };
    }
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return { requestedDaysCount: 0, requestedDates: [], hasOverlap: false, hasPastDate: false };
    }

    const dates = [];
    let overlap = false;
    let past = false;
    let curr = new Date(start);

    while (curr <= end) {
      const dStr = format(curr, 'yyyy-MM-dd');
      dates.push(dStr);
      if (dStr < todayStr) {
        past = true;
      }
      if (isDateOnLeave(dStr)) {
        overlap = true;
      }
      curr = addDays(curr, 1);
    }

    return {
      requestedDaysCount: dates.length,
      requestedDates: dates,
      hasOverlap: overlap,
      hasPastDate: past
    };
  }, [startDate, endDate, todayStr]);

  // Validation rules
  const validationError = useMemo(() => {
    if (!user) {
      return 'Please sign in to apply for annual leave.';
    }
    if (balance.remaining <= 0) {
      return 'Annual leave allowance exhausted (0/36 remaining). Your allowance will reset to 36 on January 1st.';
    }
    if (!startDate || !endDate) {
      return 'Please select valid start and end dates.';
    }
    if (startDate > endDate) {
      return 'End date cannot be earlier than start date.';
    }
    if (hasPastDate) {
      return 'Leave cannot be applied for past dates.';
    }
    if (hasOverlap) {
      return 'One or more selected dates are already on leave.';
    }
    if (requestedDaysCount > balance.remaining) {
      return `Selected period (${requestedDaysCount} days) exceeds your remaining leave balance (${balance.remaining} days).`;
    }
    if (getRatedTaskNoteDateInSelection) {
      return `Leave cannot be applied for ${getRatedTaskNoteDateInSelection} because a Task Note has already been rated for this day.`;
    }
    return null;
  }, [user, balance.remaining, startDate, endDate, hasPastDate, hasOverlap, requestedDaysCount, getRatedTaskNoteDateInSelection]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validationError || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const result = await applyUserLeaveApi({
        startDate,
        endDate,
        reason: reason.trim()
      });

      if (onLeaveApplied) {
        onLeaveApplied(result);
      }
      onClose();
    } catch (err) {
      console.error('Failed to apply leave:', err);
      setErrorMessage(err.message || 'Failed to apply leave. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 999999 }}>
      <div
        className="modal-content animate-pop-in leave-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '92%',
          background: 'linear-gradient(145deg, #13172b 0%, #0d101d 100%)',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(139, 92, 246, 0.15)',
          borderRadius: '20px',
          padding: '24px',
          color: 'var(--text-primary)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(139, 92, 246, 0.18)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Calendar size={22} color="#a78bfa" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Annual Leave
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Balance: <strong style={{ color: '#a78bfa' }}>{balance.remaining}/{balance.total}</strong> days
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              borderRadius: '50%',
              padding: '6px',
              background: 'var(--bg-glass-light)',
              border: '1px solid var(--border-glass)'
            }}
          >
            <X size={18} color="var(--text-muted)" />
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          gap: '6px',
          background: 'rgba(255, 255, 255, 0.04)',
          padding: '4px',
          borderRadius: '10px',
          marginBottom: '18px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('apply')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === 'apply' ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
              color: activeTab === 'apply' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            Apply Leave
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === 'history' ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
              color: activeTab === 'history' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            Leave History ({leaveHistory.length})
          </button>
        </div>

        {activeTab === 'apply' ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Allowance Summary Card */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              textAlign: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Total Annual</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>{balance.total}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Used</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f59e0b' }}>{balance.used}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Remaining</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: balance.remaining > 0 ? '#10b981' : '#ef4444' }}>
                  {balance.remaining}
                </div>
              </div>
            </div>

            {/* Date Pickers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  min={todayStr}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setStartDate(newStart);
                    if (newStart > endDate) setEndDate(newStart);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || todayStr}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>

            {/* Requested Days Duration Counter */}
            {requestedDaysCount > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                fontSize: '0.82rem'
              }}>
                <span style={{ color: 'var(--text-muted)' }}>Duration:</span>
                <span style={{ fontWeight: 700, color: '#a78bfa' }}>
                  {requestedDaysCount} {requestedDaysCount === 1 ? 'day' : 'days'}
                </span>
              </div>
            )}

            {/* Reason Input (Optional) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Reason (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Vacation, personal leave..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={100}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            {/* Irreversible Warning & Streak Alert */}
            <div style={{
              display: 'flex',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              fontSize: '0.76rem',
              color: '#fca5a5',
              lineHeight: '1.4'
            }}>
              <ShieldAlert size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Important:</strong> Once applied, leave cannot be retrieved or cancelled. Applying leave will completely break your current streak and pause Task Notes for the applied period. Normal tasks remain usable.
              </div>
            </div>

            {/* Error Message */}
            {(errorMessage || validationError) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                fontSize: '0.78rem',
                color: '#f87171'
              }}>
                <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>{errorMessage || validationError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
                style={{ flex: 1, padding: '10px', borderRadius: '10px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Boolean(validationError) || isSubmitting}
                className="btn btn-primary"
                style={{
                  flex: 1.5,
                  padding: '10px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  color: '#ffffff',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  opacity: (Boolean(validationError) || isSubmitting) ? 0.6 : 1,
                  cursor: (Boolean(validationError) || isSubmitting) ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="btn-spinner" />
                    <span>Applying...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Confirm Leave</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Leave History Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
            {leaveHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No annual leaves applied yet for this calendar year.
              </div>
            ) : (
              leaveHistory.map((leave, idx) => (
                <div
                  key={leave._id || leave.id || idx}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.82rem'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {leave.startDate === leave.endDate ? leave.startDate : `${leave.startDate} to ${leave.endDate}`}
                    </div>
                    {leave.reason && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {leave.reason}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: 'rgba(139, 92, 246, 0.15)',
                      color: '#a78bfa',
                      border: '1px solid rgba(139, 92, 246, 0.3)'
                    }}>
                      {leave.daysCount} {leave.daysCount === 1 ? 'day' : 'days'}
                    </span>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Permanent
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
