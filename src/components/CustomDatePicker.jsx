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
  const effectiveToday = todayStr || format(new Date(), 'yyyy-MM-dd');

  // Check if previous/next months have any valid data (if validTaskDates provided)
  const prevMonthDate = subMonths(viewDate, 1);
  const prevMonthDays = eachDayOfInterval({ start: startOfMonth(prevMonthDate), end: endOfMonth(prevMonthDate) });
  const isPrevDisabled = validTaskDates && validTaskDates.length > 0
    ? !prevMonthDays.some(dObj => validSet.has(format(dObj, 'yyyy-MM-dd')))
    : false;

  const nextMonthDate = addMonths(viewDate, 1);
  const nextMonthDays = eachDayOfInterval({ start: startOfMonth(nextMonthDate), end: endOfMonth(nextMonthDate) });
  const isNextDisabled = (validTaskDates && validTaskDates.length > 0
    ? !nextMonthDays.some(dObj => {
        const dStr = format(dObj, 'yyyy-MM-dd');
        return dStr <= effectiveToday && validSet.has(dStr);
      })
    : false) || format(viewDate, 'yyyy-MM') >= format(new Date(), 'yyyy-MM');

  return (
    <div ref={popoverRef} style={{ position: 'relative', display: 'inline-flex', zIndex: 105 }}>
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
          className="animate-pop-in date-picker-popover card-glass"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 99999,
            width: '290px',
            padding: '16px',
            borderRadius: '16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glass)',
            boxShadow: 'var(--shadow-lg)',
            backdropFilter: 'blur(20px)',
            color: 'var(--text-primary)'
          }}
        >
          {/* Header Month Nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <button
              type="button"
              disabled={isPrevDisabled}
              onClick={(e) => !isPrevDisabled && handlePrevMonth(e)}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
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
              <ChevronLeft size={16} />
            </button>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 700, letterSpacing: '0.3px' }}>
              {format(viewDate, 'MMMM yyyy')}
            </strong>
            <button
              type="button"
              disabled={isNextDisabled}
              onClick={(e) => !isNextDisabled && handleNextMonth(e)}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                border: '1px solid var(--border-glass)',
                background: 'var(--bg-glass-light)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isNextDisabled ? 'not-allowed' : 'pointer',
                opacity: isNextDisabled ? 0.3 : 1
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Days of Week Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '8px' }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <span key={day} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
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
              const isFuture = dayStr > effectiveToday;
              const isSelected = dayStr === currentDateStr;
              const isToday = dayStr === todayStr;
              const hasData = validSet.has(dayStr) && !isFuture;

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
                    height: '34px',
                    borderRadius: '8px',
                    border: isSelected
                      ? '1px solid var(--accent-primary)'
                      : (hasData ? '1px solid var(--border-glass)' : '1px solid transparent'),
                    background: isSelected
                      ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                      : (isToday ? 'rgba(99, 102, 241, 0.18)' : (hasData ? 'var(--bg-glass-light)' : 'transparent')),
                    color: isSelected
                      ? '#ffffff'
                      : (hasData ? 'var(--text-primary)' : 'var(--text-muted)'),
                    opacity: hasData ? 1 : 0.25,
                    cursor: hasData ? 'pointer' : 'not-allowed',
                    pointerEvents: hasData ? 'auto' : 'none',
                    fontSize: '0.85rem',
                    fontWeight: isSelected || isToday ? 700 : 500,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 4px 12px rgba(99, 102, 241, 0.4)' : 'none'
                  }}
                  title={hasData ? (isToday ? "Today" : `Tasks recorded for ${dayStr}`) : "No task data available on this date"}
                >
                  {format(dayObj, 'd')}
                  {hasData && !isSelected && (
                    <span style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: isToday ? '#f59e0b' : 'var(--accent-primary)',
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
