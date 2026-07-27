import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { format, addHours } from 'date-fns';

export default function AddTaskModal({ isOpen = true, onClose, onAdd, templates = [] }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Work');
  const [priority, setPriority] = useState('Med');
  const [dueDateTime, setDueDateTime] = useState('');
  const [minDateTime, setMinDateTime] = useState('');

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const minStr = format(now, "yyyy-MM-dd'T'HH:mm");
      setMinDateTime(minStr);

      const defaultDue = addHours(now, 2);
      setDueDateTime(format(defaultDue, "yyyy-MM-dd'T'HH:mm"));
      setTitle('');
      setCategory('Work');
      setPriority('Med');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const now = new Date();
    let dueObj = new Date();
    
    if (dueDateTime) {
      const d = new Date(dueDateTime);
      if (!isNaN(d.getTime())) {
        dueObj = d;
      }
    }

    if (dueObj < now) {
      alert("⚠️ Due date & time cannot be in the past! Please select a valid current or future date and time.");
      const updatedMin = format(new Date(), "yyyy-MM-dd'T'HH:mm");
      setDueDateTime(updatedMin);
      setMinDateTime(updatedMin);
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

  const handleDateChange = (e) => {
    const val = e.target.value;
    const currentMin = format(new Date(), "yyyy-MM-dd'T'HH:mm");
    if (val && val < currentMin) {
      setDueDateTime(currentMin);
    } else {
      setDueDateTime(val);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
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

          <div className="form-group">
            <label className="form-label">Due Date & Time</label>
            <input 
              type="datetime-local" 
              className="input"
              value={dueDateTime}
              min={minDateTime}
              onChange={handleDateChange} 
              required 
            />
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
