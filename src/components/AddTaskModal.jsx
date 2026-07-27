import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { format, addHours } from 'date-fns';

export default function AddTaskModal({ isOpen = true, onClose, onAdd, templates = [] }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Work');
  const [priority, setPriority] = useState('Med');

  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayDateStr);
  const [selectedHour, setSelectedHour] = useState(() => addHours(new Date(), 2).getHours());
  const [selectedMinute, setSelectedMinute] = useState(() => addHours(new Date(), 2).getMinutes());

  const now = new Date();
  const isSelectedToday = selectedDate === todayDateStr;
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  useEffect(() => {
    if (isOpen) {
      const initialDate = format(new Date(), 'yyyy-MM-dd');
      const initialDue = addHours(new Date(), 2);
      setSelectedDate(initialDate);
      setSelectedHour(initialDue.getHours());
      setSelectedMinute(initialDue.getMinutes());
      setTitle('');
      setCategory('Work');
      setPriority('Med');
    }
  }, [isOpen]);

  // Clamp hour/minute if today is selected and selected time is in the past
  useEffect(() => {
    if (isSelectedToday) {
      if (selectedHour < currentHour) {
        setSelectedHour(currentHour);
        setSelectedMinute(Math.min(currentMinute + 5, 59));
      } else if (selectedHour === currentHour && selectedMinute < currentMinute) {
        setSelectedMinute(Math.min(currentMinute + 5, 59));
      }
    }
  }, [selectedDate, isSelectedToday, currentHour, currentMinute, selectedHour, selectedMinute]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const [year, month, day] = selectedDate.split('-').map(Number);
    const dueObj = new Date(year, month - 1, day, selectedHour, selectedMinute, 0);

    const currentTime = new Date();
    if (dueObj < currentTime) {
      alert("⚠️ Due date & time cannot be in the past! Please select a valid current or future date and time.");
      setSelectedDate(format(currentTime, 'yyyy-MM-dd'));
      setSelectedHour(currentTime.getHours());
      setSelectedMinute(Math.min(currentTime.getMinutes() + 5, 59));
      return;
    }

    onAdd({
      title: title.trim(),
      category,
      priority,
      dueDateTime: dueObj.toISOString(),
      status: 'pending'
    });
    onClose();
  };

  const handleTemplateChange = (e) => {
    const tpl = templates.find(t => t.id === e.target.value);
    if (tpl) {
      setTitle(tpl.title);
      setCategory(tpl.category);
      setPriority(tpl.priority);
    }
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Add New Task</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {templates.length > 0 && (
            <div className="form-group">
              <label className="form-label">Quick Template</label>
              <select className="select" onChange={handleTemplateChange} defaultValue="">
                <option value="" disabled>Select a template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          )}
          
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

          <div className="form-group">
            <label className="form-label">Category</label>
            <div className="segmented">
              {['Work', 'Learning', 'Health', 'Personal'].map(cat => (
                <div 
                  key={cat} 
                  className={`segmented-option ${category === cat ? 'active' : ''}`} 
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Priority</label>
            <div className="segmented">
              {['High', 'Med', 'Low'].map(pri => (
                <div 
                  key={pri} 
                  className={`segmented-option ${priority === pri ? 'active' : ''}`} 
                  onClick={() => setPriority(pri)}
                >
                  {pri}
                </div>
              ))}
            </div>
          </div>

          {/* Custom Date & Time Picker */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Due Date & Time</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: '700' }}>
                ⏰ {formattedPreview}
              </span>
            </label>

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPresetTime(30)} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>+30 Min</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPresetTime(60)} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>+1 Hour</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPresetTime(120)} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>+2 Hours</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={setEndOfDay} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>End of Day (11:59 PM)</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '8px' }}>
              {/* Date Input */}
              <input
                type="date"
                className="input"
                min={todayDateStr}
                value={selectedDate}
                onChange={e => {
                  const val = e.target.value;
                  if (val && val >= todayDateStr) {
                    setSelectedDate(val);
                  }
                }}
                required
                style={{ padding: '8px 10px', fontSize: '0.85rem' }}
              />

              {/* Hour Dropdown (Disables Past Hours for Today) */}
              <select
                className="select"
                value={selectedHour}
                onChange={e => setSelectedHour(Number(e.target.value))}
                style={{ padding: '8px 10px', fontSize: '0.85rem' }}
              >
                {Array.from({ length: 24 }).map((_, h) => {
                  const isPast = isSelectedToday && h < currentHour;
                  const ampm = h >= 12 ? 'PM' : 'AM';
                  const displayH = h % 12 === 0 ? 12 : h % 12;
                  return (
                    <option key={h} value={h} disabled={isPast}>
                      {String(displayH).padStart(2, '0')}:00 {ampm} {isPast ? '(Past)' : ''}
                    </option>
                  );
                })}
              </select>

              {/* Minute Dropdown (Disables Past Minutes for Current Hour of Today) */}
              <select
                className="select"
                value={selectedMinute}
                onChange={e => setSelectedMinute(Number(e.target.value))}
                style={{ padding: '8px 10px', fontSize: '0.85rem' }}
              >
                {Array.from({ length: 60 }).map((_, m) => {
                  const isPast = isSelectedToday && selectedHour === currentHour && m < currentMinute;
                  return (
                    <option key={m} value={m} disabled={isPast}>
                      :{String(m).padStart(2, '0')} {isPast ? '(Past)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Task</button>
          </div>
        </form>
      </div>
    </div>
  );
}
