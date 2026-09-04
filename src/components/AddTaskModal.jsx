import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, Zap, Check, Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format, addHours, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import * as store from '../store/store';

export default function AddTaskModal({ isOpen = true, onClose, onAdd, templates = [] }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Work');
  const [priority, setPriority] = useState('Med');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(() => format(addHours(new Date(), 2), 'yyyy-MM-dd'));
  const [selectedHour, setSelectedHour] = useState(() => addHours(new Date(), 2).getHours());
  const [selectedMinute, setSelectedMinute] = useState(() => addHours(new Date(), 2).getMinutes());

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  
  // Custom Dropdown Open States
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isHourPickerOpen, setIsHourPickerOpen] = useState(false);
  const [isMinutePickerOpen, setIsMinutePickerOpen] = useState(false);

  // Calendar View Month state for Modal Date Picker
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    try { return addHours(new Date(), 2); } catch { return new Date(); }
  });

  const templateMenuRef = useRef(null);
  const datePickerRef = useRef(null);
  const hourPickerRef = useRef(null);
  const minutePickerRef = useRef(null);

  const now = new Date();
  const isSelectedToday = selectedDate === todayDateStr;
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      const initialDue = addHours(new Date(), 2);
      const initialDate = format(initialDue, 'yyyy-MM-dd');
      setSelectedDate(initialDate);
      setSelectedHour(initialDue.getHours());
      setSelectedMinute(initialDue.getMinutes());
      try { setCalendarViewDate(parseISO(initialDate)); } catch {}
      setTitle('');
      setCategory('Work');
      setPriority('Med');
      setSelectedTemplateId('');
      setIsTemplateMenuOpen(false);
      setIsDatePickerOpen(false);
      setIsHourPickerOpen(false);
      setIsMinutePickerOpen(false);
      setIsSubmitting(false);
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isOpen]);

  // Click Outside Listener for all dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target)) {
        setIsTemplateMenuOpen(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
        setIsDatePickerOpen(false);
      }
      if (hourPickerRef.current && !hourPickerRef.current.contains(e.target)) {
        setIsHourPickerOpen(false);
      }
      if (minutePickerRef.current && !minutePickerRef.current.contains(e.target)) {
        setIsMinutePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clamp hour/minute if selected datetime is in the past
  useEffect(() => {
    if (!selectedDate) return;
    const [year, month, day] = selectedDate.split('-').map(Number);
    const selectedDateTime = new Date(year, month - 1, day, selectedHour, selectedMinute, 0);
    const nowTime = new Date();
    if (selectedDateTime <= nowTime) {
      if (selectedDate < todayDateStr) {
        setSelectedDate(todayDateStr);
      }
      if (selectedDate <= todayDateStr) {
        const nextMinute = new Date(nowTime.getTime() + 60 * 1000);
        setSelectedHour(nextMinute.getHours());
        setSelectedMinute(nextMinute.getMinutes());
      }
    }
  }, [selectedDate, todayDateStr, selectedHour, selectedMinute]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    const [year, month, day] = selectedDate.split('-').map(Number);
    const dueObj = new Date(year, month - 1, day, selectedHour, selectedMinute, 0);

    const currentTime = new Date();
    if (dueObj < currentTime) {
      alert("⚠️ Due date & time cannot be in the past! Please select a valid current or future date and time.");
      const fallbackDue = addHours(currentTime, 1);
      setSelectedDate(format(fallbackDue, 'yyyy-MM-dd'));
      setSelectedHour(fallbackDue.getHours());
      setSelectedMinute(fallbackDue.getMinutes());
      return;
    }

    setIsSubmitting(true);
    try {
      await onAdd({
        title: title.trim(),
        category,
        priority,
        dueDateTime: dueObj.toISOString(),
        status: 'pending'
      });
      onClose();
    } catch (err) {
      // Handled by onAdd / toast; keep modal open so user does not lose input
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyTemplate = (tpl) => {
    if (!tpl) return;
    setSelectedTemplateId(tpl.id);
    setTitle(tpl.title);
    setCategory(tpl.category);
    setPriority(tpl.priority);

    const currentToday = format(new Date(), 'yyyy-MM-dd');
    setSelectedDate(currentToday);

    let targetH = selectedHour;
    let targetM = selectedMinute;

    if (tpl.defaultHour !== undefined && tpl.defaultHour !== null) {
      targetH = Number(tpl.defaultHour);
    } else if (tpl.relativeTime) {
      const parts = tpl.relativeTime.split(':').map(Number);
      if (parts.length >= 1 && !isNaN(parts[0])) targetH = parts[0];
    }

    if (tpl.defaultMinute !== undefined && tpl.defaultMinute !== null) {
      targetM = Number(tpl.defaultMinute);
    } else if (tpl.relativeTime) {
      const parts = tpl.relativeTime.split(':').map(Number);
      if (parts.length === 2 && !isNaN(parts[1])) targetM = parts[1];
    }

    const nowObj = new Date();
    const curH = nowObj.getHours();
    const curM = nowObj.getMinutes();

    if (targetH < curH || (targetH === curH && targetM < curM)) {
      targetH = curH;
      targetM = Math.min(curM + 5, 59);
    }

    setSelectedHour(targetH);
    setSelectedMinute(targetM);
    setIsTemplateMenuOpen(false);
  };

  const setPresetTime = (minutesToAdd) => {
    const target = new Date(Date.now() + minutesToAdd * 60 * 1000);
    setSelectedDate(format(target, 'yyyy-MM-dd'));
    setSelectedHour(target.getHours());
    setSelectedMinute(target.getMinutes());
  };

  const setEndOfDay = () => {
    setSelectedDate(todayDateStr);
    setSelectedHour(23);
    setSelectedMinute(59);
  };

  const formattedPreview = (() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      return format(new Date(y, m - 1, d, selectedHour, selectedMinute), 'iii, MMM d • hh:mm a');
    } catch {
      return '';
    }
  })();

  const formatDisplayDate = (dStr) => {
    try {
      const parsed = parseISO(dStr);
      if (!isNaN(parsed.getTime())) return format(parsed, 'MMM d, yyyy');
    } catch {}
    return dStr;
  };

  // Calendar calculations for Modal Date Picker
  const monthStart = startOfMonth(calendarViewDate);
  const monthEnd = endOfMonth(calendarViewDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOffset = getDay(monthStart);

  const effectiveTemplates = templates && templates.length > 0 ? templates : store.getTemplates();

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-pop-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', overflow: 'visible' }}>
        <div className="modal-header">
          <h2 className="modal-title">Add New Task</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-body" style={{ overflow: 'visible' }}>
          <div className="modal-form-scroll" style={{ overflow: 'visible' }}>
            {/* Quick Template */}
            {effectiveTemplates.length > 0 && (
              <div className="form-group" ref={templateMenuRef} style={{ position: 'relative' }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={14} color="var(--accent-primary)" /> Quick Template
                  </span>
                  {selectedTemplateId && (
                    <span 
                      onClick={() => setSelectedTemplateId('')} 
                      style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Clear selection
                    </span>
                  )}
                </label>

                {/* Custom Template Trigger */}
                <div 
                  className="template-select-trigger"
                  onClick={() => {
                    setIsTemplateMenuOpen(!isTemplateMenuOpen);
                    setIsDatePickerOpen(false);
                    setIsHourPickerOpen(false);
                    setIsMinutePickerOpen(false);
                  }}
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: isTemplateMenuOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-md)',
                    padding: '9px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isTemplateMenuOpen ? '0 0 12px rgba(99, 102, 241, 0.3)' : 'none'
                  }}
                >
                  {(() => {
                    const activeIdx = effectiveTemplates.findIndex(t => t.id === selectedTemplateId);
                    const activeTpl = activeIdx !== -1 ? effectiveTemplates[activeIdx] : null;
                    if (activeTpl) {
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--accent-primary)', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '4px', padding: '1px 5px', flexShrink: 0 }}>
                            #{activeIdx + 1}
                          </span>
                          <span style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {activeTpl.title}
                          </span>
                          <span className="badge badge-cat" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>{activeTpl.category}</span>
                        </div>
                      );
                    }
                    return (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Select a template to auto-fill details...
                      </span>
                    );
                  })()}
                  <ChevronDown size={16} color="var(--text-muted)" style={{ transform: isTemplateMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                </div>

                {/* Custom Floating Glass Menu */}
                {isTemplateMenuOpen && (
                  <div 
                    className="animate-pop-in card-glass"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      right: 0,
                      zIndex: 99999,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: 'var(--radius-md)',
                      padding: '6px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      boxShadow: 'var(--shadow-lg)',
                      backdropFilter: 'blur(20px)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    {effectiveTemplates.map((t, idx) => {
                      const isSelected = t.id === selectedTemplateId;
                      return (
                        <div
                          key={t.id}
                          onClick={() => applyTemplate(t)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'var(--bg-glass-light)',
                            border: isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--accent-primary)', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '4px', padding: '1px 5px', flexShrink: 0 }}>
                              #{idx + 1}
                            </span>
                            <span style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.title}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
                            <span className="badge badge-cat" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>{t.category}</span>
                            <span className="badge badge-pri" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>{t.priority}</span>
                            {t.relativeTime && (
                              <span style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: '700' }}>⏰ {t.relativeTime}</span>
                            )}
                            {isSelected && <Check size={14} color="var(--accent-primary)" style={{ marginLeft: '4px' }} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            
            {/* Task Title */}
            <div className="form-group">
              <label className="form-label">Task Title</label>
              <input 
                type="text" 
                className="input"
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                placeholder="e.g. Complete React practice block"
                required 
                autoFocus 
              />
            </div>

            {/* Category */}
            <div className="form-group">
              <label className="form-label">Category</label>
              <div className="segmented">
                {['Work', 'Learning', 'Health', 'Personal'].map(cat => (
                  <button 
                    key={cat} 
                    type="button"
                    className={`segmented-option ${category === cat ? 'active' : ''}`} 
                    onClick={() => setCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="form-group">
              <label className="form-label">Priority</label>
              <div className="segmented">
                {['High', 'Med', 'Low'].map(pri => (
                  <button 
                    key={pri} 
                    type="button"
                    className={`segmented-option ${priority === pri ? 'active' : ''}`} 
                    onClick={() => setPriority(pri)}
                  >
                    {pri}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date & Time Picker Group */}
            <div className="form-group" style={{ overflow: 'visible' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Due Date & Time</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: '700' }}>
                  ⏰ {formattedPreview}
                </span>
              </label>

              {/* Quick Presets */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPresetTime(30)} style={{ fontSize: '0.72rem', padding: '4px 8px' }}>+30 Min</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPresetTime(60)} style={{ fontSize: '0.72rem', padding: '4px 8px' }}>+1 Hour</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPresetTime(120)} style={{ fontSize: '0.72rem', padding: '4px 8px' }}>+2 Hours</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={setEndOfDay} style={{ fontSize: '0.72rem', padding: '4px 8px' }}>End of Day (11:59 PM)</button>
              </div>

              {/* Glassmorphic Date & Time Triggers Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.35fr 0.8fr', gap: '6px', position: 'relative', overflow: 'visible' }}>
                
                {/* 1. Glassmorphic Date Picker */}
                <div style={{ position: 'static' }} ref={datePickerRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDatePickerOpen(!isDatePickerOpen);
                      setIsHourPickerOpen(false);
                      setIsMinutePickerOpen(false);
                      setIsTemplateMenuOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 6px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-secondary)',
                      border: isDatePickerOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                      <CalendarIcon size={13} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{formatDisplayDate(selectedDate)}</span>
                    </div>
                    <ChevronDown size={13} color="var(--text-muted)" style={{ transform: isDatePickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                  </button>

                  {/* Calendar Popover */}
                  {isDatePickerOpen && (
                    <div
                      className="animate-pop-in date-picker-popover card-glass"
                      style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: 0,
                        zIndex: 99999,
                        width: '270px',
                        padding: '14px',
                        borderRadius: '16px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-glass)',
                        boxShadow: 'var(--shadow-lg)',
                        backdropFilter: 'blur(20px)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        {(() => {
                          const isPrevDisabled = format(calendarViewDate, 'yyyy-MM') <= format(new Date(), 'yyyy-MM');
                          return (
                            <button
                              type="button"
                              disabled={isPrevDisabled}
                              onClick={() => !isPrevDisabled && setCalendarViewDate(subMonths(calendarViewDate, 1))}
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-glass)',
                                background: 'var(--bg-glass-light)',
                                color: 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: isPrevDisabled ? 'not-allowed' : 'pointer',
                                opacity: isPrevDisabled ? 0.3 : 1
                              }}
                            >
                              <ChevronLeft size={14} />
                            </button>
                          );
                        })()}
                        <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                          {format(calendarViewDate, 'MMMM yyyy')}
                        </strong>
                        <button type="button" onClick={() => setCalendarViewDate(addMonths(calendarViewDate, 1))} style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass-light)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <ChevronRight size={14} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', marginBottom: '6px' }}>
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                          <span key={d} style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{d}</span>
                        ))}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
                        {Array.from({ length: startDayOffset }).map((_, i) => <div key={`empty_${i}`} />)}
                        {daysInMonth.map((dayObj) => {
                          const dStr = format(dayObj, 'yyyy-MM-dd');
                          const isPast = dStr < todayDateStr;
                          const isSel = dStr === selectedDate;
                          const isTod = dStr === todayDateStr;

                          return (
                            <button
                              key={dStr}
                              type="button"
                              disabled={isPast}
                              onClick={() => {
                                if (!isPast) {
                                  setSelectedDate(dStr);
                                  setIsDatePickerOpen(false);
                                }
                              }}
                              style={{
                                height: '30px',
                                borderRadius: '6px',
                                border: isSel ? '1px solid var(--accent-primary)' : '1px solid transparent',
                                background: isSel ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : (isTod ? 'rgba(99, 102, 241, 0.18)' : 'var(--bg-glass-light)'),
                                color: isSel ? '#ffffff' : (isPast ? 'var(--text-muted)' : 'var(--text-primary)'),
                                opacity: isPast ? 0.3 : 1,
                                cursor: isPast ? 'not-allowed' : 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: isSel || isTod ? 700 : 500
                              }}
                            >
                              {format(dayObj, 'd')}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Glassmorphic Hour Picker */}
                <div style={{ position: 'relative' }} ref={hourPickerRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsHourPickerOpen(!isHourPickerOpen);
                      setIsDatePickerOpen(false);
                      setIsMinutePickerOpen(false);
                      setIsTemplateMenuOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 6px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-secondary)',
                      border: isHourPickerOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                      <Clock size={13} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap' }}>
                        {String(selectedHour % 12 === 0 ? 12 : selectedHour % 12).padStart(2, '0')}:00 {selectedHour >= 12 ? 'PM' : 'AM'}
                      </span>
                    </div>
                    <ChevronDown size={13} color="var(--text-muted)" style={{ transform: isHourPickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                  </button>

                  {/* Hour Popover */}
                  {isHourPickerOpen && (
                    <div
                      className="animate-pop-in glass-popover-time card-glass"
                      style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: 0,
                        right: 0,
                        zIndex: 99999,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '12px',
                        padding: '6px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        boxShadow: 'var(--shadow-lg)',
                        backdropFilter: 'blur(20px)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px'
                      }}
                    >
                      {Array.from({ length: 24 }).map((_, h) => {
                        const isPast = isSelectedToday && h < currentHour;
                        if (isPast) return null;
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        const displayH = h % 12 === 0 ? 12 : h % 12;
                        const isSel = h === selectedHour;

                        return (
                          <div
                            key={h}
                            onClick={() => {
                              setSelectedHour(h);
                              setIsHourPickerOpen(false);
                            }}
                            style={{
                              padding: '7px 10px',
                              borderRadius: '6px',
                              background: isSel ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'var(--bg-glass-light)',
                              color: isSel ? '#ffffff' : 'var(--text-primary)',
                              cursor: 'pointer',
                              fontSize: '0.82rem',
                              fontWeight: isSel ? 700 : 500,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <span>{String(displayH).padStart(2, '0')}:00 {ampm}</span>
                            {isSel && <Check size={14} color="#ffffff" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Glassmorphic Minute Picker */}
                <div style={{ position: 'relative' }} ref={minutePickerRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMinutePickerOpen(!isMinutePickerOpen);
                      setIsDatePickerOpen(false);
                      setIsHourPickerOpen(false);
                      setIsTemplateMenuOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-secondary)',
                      border: isMinutePickerOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                  >
                    <span>:{String(selectedMinute).padStart(2, '0')}</span>
                    <ChevronDown size={14} color="var(--text-muted)" style={{ transform: isMinutePickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>

                  {/* Minute Popover */}
                  {isMinutePickerOpen && (
                    <div
                      className="animate-pop-in glass-popover-time card-glass"
                      style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: 0,
                        right: 0,
                        zIndex: 99999,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '12px',
                        padding: '6px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        boxShadow: 'var(--shadow-lg)',
                        backdropFilter: 'blur(20px)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px'
                      }}
                    >
                      {Array.from({ length: 60 }).map((_, m) => {
                        const isPast = isSelectedToday && selectedHour === currentHour && m <= currentMinute;
                        if (isPast) return null;
                        const isSel = m === selectedMinute;

                        return (
                          <div
                            key={m}
                            onClick={() => {
                              setSelectedMinute(m);
                              setIsMinutePickerOpen(false);
                            }}
                            style={{
                              padding: '7px 10px',
                              borderRadius: '6px',
                              background: isSel ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'var(--bg-glass-light)',
                              color: isSel ? '#ffffff' : 'var(--text-primary)',
                              cursor: 'pointer',
                              fontSize: '0.82rem',
                              fontWeight: isSel ? 700 : 500,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <span>:{String(m).padStart(2, '0')}</span>
                            {isSel && <Check size={14} color="#ffffff" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`}
              disabled={isSubmitting || !title.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="btn-spinner" />
                  <span>Adding Task...</span>
                </>
              ) : (
                <span>Add Task</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
