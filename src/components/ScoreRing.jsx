import React from 'react';

export default function ScoreRing({ 
  score = 0, 
  streak = { current: 0, isActive: false }, 
  averages = { week: 0, month: 0, allTime: 0 },
  details = {}
}) {
  const radius = 80;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const safeScore = Math.max(0, Math.min(10, score));
  const offset = circumference - (safeScore / 10) * circumference;

  let strokeColor = 'var(--accent-success)';
  let glowColor = 'rgba(52, 211, 153, 0.35)';
  if (safeScore < 4) {
    strokeColor = 'var(--accent-danger)';
    glowColor = 'rgba(248, 113, 113, 0.35)';
  } else if (safeScore < 7) {
    strokeColor = 'var(--accent-warning)';
    glowColor = 'rgba(251, 191, 36, 0.35)';
  }

  const size = (radius + strokeWidth) * 2;
  const center = size / 2;

  return (
    <div className="card-glass score-ring-card">
      <div className="score-ring-wrapper">
        <svg className="score-ring-svg" viewBox={`0 0 ${size} ${size}`}>
          <circle
            className="score-ring-bg"
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={strokeWidth}
          />
          {safeScore > 0 && (
            <circle
              className="score-ring-progress"
              cx={center}
              cy={center}
              r={radius}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${center} ${center})`}
            />
          )}
        </svg>

        <div className="score-ring-content">
          <div className="score-value">
            {safeScore.toFixed(1)}
            <span className="score-value-max">/10</span>
          </div>
          <div className="score-label">Daily Score</div>
          {streak.current > 0 ? (
            <div className="streak-badge streak-badge-active">
              🔥 {streak.current} {streak.current === 1 ? 'Day' : 'Days'} Streak
            </div>
          ) : (
            <div className="streak-badge streak-badge-inactive">
              ⚡ Complete a task to start streak!
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

