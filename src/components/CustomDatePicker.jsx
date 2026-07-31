import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';

export default function CustomDatePicker({
  currentDateStr,
  validTaskDates = [],
  todayStr,
  onSelectDate
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    try {
      return parseISO(currentDateStr);
    } catch {
      return new Date();
    }
  });

  const popoverRef = useRef(null);

  useEffect(() => {
    try {
      setViewDate(parseISO(currentDateStr));
    } catch (e) {}
  }, [currentDateStr]);

  // Close popover on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOffset = getDay(monthStart);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setViewDate(subMonths(viewDate, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setViewDate(addMonths(viewDate, 1));
  };

  const formatDisplayCurrent = (dateStr) => {
    try {
      const parsed = parseISO(dateStr);
      if (!isNaN(parsed.getTime())) {
        return format(parsed, 'MMM dd, yyyy');
      }
    } catch (e) {}
    return dateStr;
  };

  const validSet = new Set(validTaskDates);

  return (
    <div ref={popoverRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Trigger Button */}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'var(--bg-glass-light)',
          padding: '5px 12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-glass)',
          color: 'var(--text-primary)',
          fontWeight: 600,
          fontSize: '0.88rem',
          cursor: 'pointer'
        }}
      >
        <CalendarIcon size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <span>{formatDisplayCurrent(currentDateStr)}</span>
      </button>

      {/* Popover Calendar Grid */}
      {isOpen && (
        <div
          className="animate-pop-in card-glass"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 9999,
            width: '280px',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glass-hover)'
          }}
        >
          {/* Header Month Nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <button
              type="button"
              className="btn-icon"
              onClick={handlePrevMonth}
              style={{ padding: '4px', color: 'var(--text-primary)' }}
            >
              <ChevronLeft size={16} />
            </button>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              {format(viewDate, 'MMMM yyyy')}
            </strong>
            <button
              type="button"
              className="btn-icon"
              onClick={handleNextMonth}
              style={{ padding: '4px', color: 'var(--text-primary)' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Days of Week Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '6px' }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <span key={day} style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {/* Empty slots before month start */}
            {Array.from({ length: startDayOffset }).map((_, i) => (
              <div key={`empty_${i}`} />
            ))}

            {/* Days of month */}
            {daysInMonth.map((dayObj) => {
              const dayStr = format(dayObj, 'yyyy-MM-dd');
              const isSelected = dayStr === currentDateStr;
              const isToday = dayStr === todayStr;
              const hasData = validSet.has(dayStr);

              return (
                <button
                  key={dayStr}
                  type="button"
                  disabled={!hasData}
                  onClick={() => {
                    if (hasData) {
                      onSelectDate(dayStr);
                      setIsOpen(false);
                    }
                  }}
                  style={{
                    height: '32px',
                    borderRadius: '6px',
                    border: isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                    background: isSelected
                      ? 'var(--accent-primary)'
                      : (isToday ? 'rgba(99, 102, 241, 0.15)' : 'transparent'),
                    color: isSelected
                      ? '#ffffff'
                      : (hasData ? 'var(--text-primary)' : 'var(--text-muted)'),
                    opacity: hasData ? 1 : 0.22,
                    cursor: hasData ? 'pointer' : 'not-allowed',
                    pointerEvents: hasData ? 'auto' : 'none',
                    fontSize: '0.82rem',
                    fontWeight: isSelected || isToday ? 700 : 500,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    transition: 'all 0.15s ease'
                  }}
                  title={hasData ? (isToday ? "Today" : `Tasks recorded for ${dayStr}`) : "No task data available on this date"}
                >
                  {format(dayObj, 'd')}
                  {hasData && !isSelected && (
                    <span style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: isToday ? '#fbbf24' : '#818cf8',
                      position: 'absolute',
                      bottom: '3px'
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
