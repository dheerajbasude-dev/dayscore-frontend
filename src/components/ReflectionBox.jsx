import React, { useState } from 'react';
import { PenLine, Sparkles, CheckCircle2 } from 'lucide-react';

const QUICK_TAGS = [
  { 
    label: '🚀 High Productivity', 
    sentence: '🚀 Had a super productive day! Stayed focused and completed key targets ahead of schedule.' 
  },
  { 
    label: '🎯 Deep Focus', 
    sentence: '🎯 Maintained deep concentration today with zero major distractions.' 
  },
  { 
    label: '🚧 Blocked by Obstacle', 
    sentence: '🚧 Encountered a roadblock during my tasks today that required extra troubleshooting.' 
  },
  { 
    label: '💡 Key Insight', 
    sentence: '💡 Learned an important lesson today: breaking complex tasks into smaller steps improves efficiency.' 
  },
  { 
    label: '😴 Low Energy', 
    sentence: '😴 Energy felt low today, but stayed disciplined and kept moving forward.' 
  }
];

export default function ReflectionBox({ value, onChange, isModal = false, onClose }) {
  const [isFocused, setIsFocused] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const handleAddTag = (sentence) => {
    const current = value || '';
    const updated = current ? `${current}\n\n${sentence}` : sentence;
    onChange(updated);
    triggerSaved();
  };

  const handleChange = (val) => {
    onChange(val);
    triggerSaved();
  };

  const triggerSaved = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1800);
  };

  return (
    <div className={`reflection-box ${isFocused ? 'focused' : ''} ${isModal ? 'reflection-modal-body' : ''}`}>
      {/* Combined Header & Prompt Chips Row */}
      <div className="reflection-header-row">
        <div className="reflection-title-group">
          <PenLine size={15} color="var(--accent-primary)" />
          <span className="reflection-title">Daily Reflection</span>
          {savedToast && (
            <span className="reflection-saved-tag animate-fade-in">
              <CheckCircle2 size={12} color="#86efac" /> Saved
            </span>
          )}
        </div>

        <div className="reflection-tags-inline">
          <span className="reflection-tags-label"><Sparkles size={11} color="var(--accent-warning)" /> Prompts:</span>
          <div className="reflection-tags-list">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag.label}
                type="button"
                className="reflection-chip"
                onClick={() => handleAddTag(tag.sentence)}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="reflection-content">
        <textarea
          value={value || ''}
          onChange={e => handleChange(e.target.value)}
          placeholder="What went well today? Click a prompt above or type your reflection..."
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          rows={isModal ? 3 : (isFocused || value ? 2 : 1)}
          style={{ minHeight: isModal ? '80px' : (isFocused || value ? '54px' : '36px') }}
        />
        {isModal && onClose && (
          <div className="reflection-footer-modal" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button className="btn btn-primary btn-sm" onClick={onClose}>
              Done & Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
