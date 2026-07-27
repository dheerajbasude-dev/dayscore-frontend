import React from 'react';
import { format, subDays, startOfWeek, endOfWeek, addDays } from 'date-fns';

export default function CalendarHeatmap({ archives = [] }) {
  // Map archives to date -> score dictionary
  const archiveMap = (archives || []).reduce((acc, curr) => {
    if (curr && curr.date) {
      const cleanD = curr.date.includes('T') ? curr.date.split('T')[0] : curr.date.trim().substring(0, 10);
      acc[cleanD] = curr.score;
    }
    return acc;
  }, {});

  const getLevel = (score) => {
    if (score == null) return 0;
    if (score === 0) return 0;
    if (score < 3) return 1;
    if (score < 5) return 2;
    if (score < 7) return 3;
    if (score < 9) return 4;
    return 5;
  };

  const today = new Date();
  const startDate = startOfWeek(subDays(today, 364));
  const endDate = endOfWeek(today);

  const days = [];
  let currDate = startDate;
  while (currDate <= endDate) {
    const dateStr = format(currDate, 'yyyy-MM-dd');
    const scoreVal = archiveMap[dateStr] ?? null;
    days.push({
      date: currDate,
      dateStr,
      score: scoreVal,
      level: getLevel(scoreVal)
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
                    className={`heatmap-cell heatmap-level-${day.level}`}
                    title={`${day.dateStr}: ${day.score !== null ? `${Number(day.score).toFixed(1)}/10` : 'No activity'}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginTop: '10px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <span>Less</span>
        <div className="heatmap-cell heatmap-level-0" style={{ width: '10px', height: '10px' }} title="No Activity" />
        <div className="heatmap-cell heatmap-level-1" style={{ width: '10px', height: '10px' }} title="Score 1 - 2.9" />
        <div className="heatmap-cell heatmap-level-2" style={{ width: '10px', height: '10px' }} title="Score 3 - 4.9" />
        <div className="heatmap-cell heatmap-level-3" style={{ width: '10px', height: '10px' }} title="Score 5 - 6.9" />
        <div className="heatmap-cell heatmap-level-4" style={{ width: '10px', height: '10px' }} title="Score 7 - 8.9" />
        <div className="heatmap-cell heatmap-level-5" style={{ width: '10px', height: '10px' }} title="Score 9 - 10" />
        <span>More</span>
      </div>
    </div>
  );
}
