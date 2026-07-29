import React from 'react';
import { format, subDays, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns';

export default function CalendarHeatmap({ archives = [] }) {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Map archives to date -> record dictionary
  const archiveMap = (archives || []).reduce((acc, curr) => {
    if (curr && curr.date) {
      const cleanD = curr.date.includes('T') ? curr.date.split('T')[0] : curr.date.trim().substring(0, 10);
      acc[cleanD] = curr;
    }
    return acc;
  }, {});

  const getLevel = (record) => {
    if (!record) return 0;
    const score = Number(record.score || 0);
    const hasTasks = Boolean(record.hasTasks || (record.tasks && record.tasks.length > 0));
    const hasDone = Boolean(record.hasDone || (record.tasks && record.tasks.some(t => t.status === 'done' || t.completedAt || t.completed_at)));

    if (!hasTasks && score === 0) return 0;
    if (hasTasks && !hasDone && score === 0) return 1;

    if (score < 3) return 1;
    if (score < 5) return 2;
    if (score < 7) return 3;
    if (score < 9) return 4;
    return 5;
  };

  const startDate = startOfWeek(subDays(today, 364), { weekStartsOn: 1 }); // Monday start
  const endDate = endOfWeek(today, { weekStartsOn: 1 });

  const days = [];
  let currDate = startDate;
  while (currDate <= endDate) {
    const dateStr = format(currDate, 'yyyy-MM-dd');
    const record = archiveMap[dateStr] ?? null;
    days.push({
      date: currDate,
      dateStr,
      formattedDate: format(currDate, 'MMM dd, yyyy'),
      record,
      score: record ? Number(record.score || 0) : null,
      level: getLevel(record),
      isToday: dateStr === todayStr
    });
    currDate = addDays(currDate, 1);
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const monthLabels = [];
  let lastMonth = -1;
  weeks.forEach((week, index) => {
    const month = week[0].date.getMonth();
    if (month !== lastMonth && index > 0) {
      monthLabels.push({ label: format(week[0].date, 'MMM'), index });
      lastMonth = month;
    }
  });

  const getTooltip = (day) => {
    const dateText = day.formattedDate;
    if (day.isToday) {
      if (day.score !== null && day.record?.hasTasks) {
        return `Today (${dateText}): Score ${day.score.toFixed(1)}/10`;
      }
      return `Today (${dateText}): Ongoing`;
    }
    if (!day.record || !day.record.hasTasks) {
      return `${dateText}: No activity recorded`;
    }
    return `${dateText}: Score ${day.score.toFixed(1)}/10`;
  };

  return (
    <div className="heatmap-wrapper">
      <div className="heatmap-container">
        <div className="heatmap-months">
          {monthLabels.map((m, i) => (
            <span key={i} style={{ gridColumn: m.index + 1 }}>{m.label}</span>
          ))}
        </div>
        <div className="heatmap-body">
          <div className="heatmap-days">
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>
          <div className="heatmap-grid">
            {weeks.map((week, wIndex) => (
              <div key={wIndex} className="heatmap-week">
                {week.map((day, dIndex) => (
                  <div 
                    key={dIndex} 
                    className={`heatmap-cell heatmap-level-${day.level} ${day.isToday ? 'heatmap-cell-today' : ''}`}
                    title={getTooltip(day)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginTop: '12px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <span>Less</span>
        <div className="heatmap-cell heatmap-level-0" style={{ width: '10px', height: '10px' }} title="No Activity" />
        <div className="heatmap-cell heatmap-level-1" style={{ width: '10px', height: '10px' }} title="Score 0.0 - 2.9" />
        <div className="heatmap-cell heatmap-level-2" style={{ width: '10px', height: '10px' }} title="Score 3.0 - 4.9" />
        <div className="heatmap-cell heatmap-level-3" style={{ width: '10px', height: '10px' }} title="Score 5.0 - 6.9" />
        <div className="heatmap-cell heatmap-level-4" style={{ width: '10px', height: '10px' }} title="Score 7.0 - 8.9" />
        <div className="heatmap-cell heatmap-level-5" style={{ width: '10px', height: '10px' }} title="Score 9.0 - 10" />
        <span>More</span>
      </div>
    </div>
  );
}
