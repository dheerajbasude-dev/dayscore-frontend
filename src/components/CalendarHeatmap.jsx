import React from 'react';
import { format, subDays, startOfWeek, endOfWeek, addDays } from 'date-fns';

export default function CalendarHeatmap({ archives = [] }) {
  // Map archives to date -> score dictionary
  const archiveMap = (archives || []).reduce((acc, curr) => {
    if (curr && curr.date) {
      acc[curr.date] = curr.score;
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
  let currentMonth = -1;
  weeks.forEach((week, index) => {
    const month = week[0].date.getMonth();
    if (month !== currentMonth) {
      monthLabels.push({ label: format(week[0].date, 'MMM'), index });
      currentMonth = month;
    }
  });

  return (
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
                  title={`${day.dateStr}: ${day.score !== null ? day.score.toFixed(1) : 'No data'}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
