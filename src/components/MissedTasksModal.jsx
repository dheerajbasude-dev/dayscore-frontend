import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Calendar, ArrowRight, CheckCircle2, Trash2, Zap, Sparkles, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function MissedTasksModal({
  isOpen,
  onClose,
  pastUnfinishedTasks = [],
  onCarryOverTask,
  onCompleteTask,
  onDeleteTask,
  onCarryOverAll,
  onJumpToDate
}) {
  const [processingId, setProcessingId] = useState(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [localRemovedIds, setLocalRemovedIds] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      setLocalRemovedIds(new Set());
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter tasks strictly to active pending tasks not removed locally
  const activeUnfinishedTasks = pastUnfinishedTasks.filter(t => {
    const id = t.id || t._id;
    return !localRemovedIds.has(id) && (t.status === 'pending' || t.status === 'inprogress');
  });

  // Group tasks by date
  const groupedTasks = activeUnfinishedTasks.reduce((acc, task) => {
    const d = task.taskDate || task.date || 'Unknown';
    if (!acc[d]) acc[d] = [];
    acc[d].push(task);
    return acc;
  }, {});

  const datesSorted = Object.keys(groupedTasks).sort().reverse(); // Newest past date first
  const totalCount = activeUnfinishedTasks.length;

  const handleCarryOver = async (task) => {
    const id = task.id || task._id;
    setProcessingId(`carry_${id}`);
    setLocalRemovedIds(prev => new Set(prev).add(id));
    try {
      await onCarryOverTask(task);
    } catch (e) {
      console.error('Carry over task error:', e);
    } finally {
      setProcessingId(null);
    }
  };

  const handleComplete = async (task) => {
    const id = task.id || task._id;
    setProcessingId(`complete_${id}`);
    setLocalRemovedIds(prev => new Set(prev).add(id));
    try {
      await onCompleteTask(task);
    } catch (e) {
      console.error('Complete task error:', e);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (task) => {
    const id = task.id || task._id;
    setProcessingId(`delete_${id}`);
    setLocalRemovedIds(prev => new Set(prev).add(id));
    try {
      await onDeleteTask(task);
    } catch (e) {
      console.error('Delete task error:', e);
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkCarryOver = async () => {
    if (bulkProcessing) return;
    setBulkProcessing(true);
    const allIds = activeUnfinishedTasks.map(t => t.id || t._id);
    setLocalRemovedIds(prev => {
      const next = new Set(prev);
      allIds.forEach(id => next.add(id));
      return next;
    });
    try {
      await onCarryOverAll();
    } catch (e) {
      console.error('Bulk carry over error:', e);
    } finally {
      setBulkProcessing(false);
    }
  };

  const formatDateDisplay = (dateStr) => {
    try {
      if (!dateStr || dateStr === 'Unknown') return dateStr;
      const parsed = parseISO(dateStr);
      if (isNaN(parsed.getTime())) return dateStr;
      return format(parsed, 'EEEE, MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatTimeDisplay = (isoStr) => {
    if (!isoStr) return null;
    try {
      const parsed = typeof isoStr === 'string' ? parseISO(isoStr) : new Date(isoStr);
      if (isNaN(parsed.getTime())) return isoStr;
      return format(parsed, 'MMM d, h:mm a');
    } catch {
      return isoStr;
    }
  };

  const getPriorityBadgeStyle = (priority) => {
    const p = (priority || 'Med').toLowerCase();
    if (p === 'high') return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
    if (p === 'low') return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' };
    return { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content animate-pop-in"
        style={{ maxWidth: '680px', width: '92%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ paddingBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertCircle size={18} color="#f59e0b" />
              </div>
              <div>
                <h3 className="modal-title" style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Manage Pending Missed Tasks
                  {totalCount > 0 && (
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#fbbf24',
                      border: '1px solid rgba(245, 158, 11, 0.3)'
                    }}>
                      {totalCount} Pending
                    </span>
                  )}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Review, complete, or carry over pending tasks left behind from previous days.
                </p>
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close Modal">
            <X size={18} />
          </button>
        </div>

        {/* Modal Form Body */}
        <div className="modal-form-body" style={{ gap: '16px', paddingTop: '4px' }}>
          {totalCount === 0 ? (
            /* Empty State */
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-lg)',
              border: '1px border-glass'
            }}>
              <div style={{
                fontSize: '2.5rem',
                marginBottom: '12px'
              }}>
                🎉
              </div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                All Backlog Cleared!
              </h4>
              <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '360px', marginLeft: 'auto', marginRight: 'auto' }}>
                You have no pending tasks from previous days. Outstanding productivity!
              </p>
              <button className="btn btn-primary" onClick={onClose}>
                Back to Dashboard
              </button>
            </div>
          ) : (
            <>
              {/* Bulk Header Action Banner */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(99, 102, 241, 0.1) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} color="#fbbf24" />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    Quick Resolve: Bring all {totalCount} pending task{totalCount === 1 ? '' : 's'} to today's plan
                  </span>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleBulkCarryOver}
                  disabled={bulkProcessing}
                  style={{
                    fontSize: '0.8rem',
                    padding: '6px 14px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                  }}
                >
                  <Zap size={14} style={{ marginRight: '6px' }} />
                  {bulkProcessing ? 'Moving All...' : `Carry Over All (${totalCount})`}
                </button>
              </div>

              {/* Grouped Date Lists */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '4px' }}>
                {datesSorted.map((dateStr) => {
                  const dayTasks = groupedTasks[dateStr];
                  return (
                    <div key={dateStr} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      {/* Date Group Header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                        paddingBottom: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Calendar size={15} color="#f59e0b" />
                          <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {formatDateDisplay(dateStr)}
                          </strong>
                          <span style={{
                            fontSize: '0.72rem',
                            padding: '1px 6px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: 'var(--text-muted)'
                          }}>
                            {dayTasks.length} task{dayTasks.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            onJumpToDate(dateStr);
                            onClose();
                          }}
                          style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                          title="View dashboard for this date"
                        >
                          Jump to Date
                        </button>
                      </div>

                      {/* Task Item Cards */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {dayTasks.map((t) => {
                          const taskId = t.id || t._id;
                          const pStyle = getPriorityBadgeStyle(t.priority);
                          const isProcessing = processingId && processingId.includes(taskId);

                          return (
                            <div
                              key={taskId}
                              style={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-glass-hover)',
                                borderRadius: 'var(--radius-md)',
                                padding: '10px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px',
                                flexWrap: 'wrap'
                              }}
                            >
                              {/* Left Info */}
                              <div style={{ flex: 1, minWidth: '200px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                  <span style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: pStyle.bg,
                                    color: pStyle.color,
                                    border: `1px solid ${pStyle.border}`
                                  }}>
                                    {t.priority || 'Med'}
                                  </span>
                                  <span style={{
                                    fontSize: '0.7rem',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    color: 'var(--text-muted)'
                                  }}>
                                    {t.category || 'Work'}
                                  </span>
                                  {(t.dueDateTime || t.due_date_time) && (
                                    <span style={{ fontSize: '0.72rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <Clock size={12} />
                                      Due: {formatTimeDisplay(t.dueDateTime || t.due_date_time)}
                                    </span>
                                  )}
                                </div>
                                <span style={{
                                  fontSize: '0.9rem',
                                  color: 'var(--text-primary)',
                                  fontWeight: 500,
                                  display: 'block',
                                  wordBreak: 'break-word'
                                }}>
                                  {t.title}
                                </span>
                              </div>

                              {/* Right Action Buttons */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {/* Move to Today Button */}
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleCarryOver(t)}
                                  disabled={isProcessing}
                                  style={{
                                    fontSize: '0.78rem',
                                    padding: '5px 10px',
                                    background: 'rgba(99, 102, 241, 0.2)',
                                    border: '1px solid rgba(99, 102, 241, 0.4)',
                                    color: '#818cf8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                  title="Move task date to today"
                                >
                                  <ArrowRight size={13} />
                                  Move to Today
                                </button>

                                {/* Delete Button */}
                                <button
                                  className="btn-icon"
                                  onClick={() => handleDelete(t)}
                                  disabled={isProcessing}
                                  style={{
                                    padding: '5px',
                                    color: 'var(--text-muted)'
                                  }}
                                  title="Delete task"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
