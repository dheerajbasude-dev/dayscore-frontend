import React from 'react';

export default function ScoreRing({ 
  score = 0, 
  streak = { current: 0, isActive: false }, 
  averages = { week: 0, month: 0, allTime: 0 },
  details = {},
  label = 'Daily Score'
}) {
  const radius = 70;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const safeScore = Math.max(0, Math.min(10, Number(score) || 0));

  const hasEvaluated = Boolean(
    details?.breakdown?.totalTasks > 0 ||
    details?.breakdown?.missedCount > 0 ||
    details?.breakdown?.doneCount > 0 ||
    (details?.score !== undefined && details?.score !== null)
  );

  // When score is 0 with evaluated tasks (e.g. 1 missed task with score 0), render a subtle red arc so the red penalty score is visibly reflected on the ring
  const displayScore = (safeScore === 0 && hasEvaluated) ? 0.35 : safeScore;
  const offset = circumference - (displayScore / 10) * circumference;

  let strokeColor = '#22c55e'; // Green (> 8.5)
  let glowColor = 'rgba(34, 197, 94, 0.35)';

  if (safeScore <= 4) {
    // Red (<= 4)
    strokeColor = '#ef4444';
    glowColor = 'rgba(239, 68, 68, 0.35)';
  } else if (safeScore <= 8.5) {
    // Blue (> 4 && <= 8.5)
    strokeColor = '#3b82f6';
    glowColor = 'rgba(59, 130, 246, 0.35)';
  }

  const size = (radius + strokeWidth) * 2;
  const center = size / 2;

  return (
    <div className="card-glass score-ring-card">
      <div className="score-ring-wrapper">
        <div className="score-ring-ambient-glow" style={{ background: glowColor }} />
        <svg className="score-ring-svg" viewBox={`0 0 ${size} ${size}`}>
          <circle
            className="score-ring-bg"
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={strokeWidth}
          />
          {(safeScore > 0 || hasEvaluated) && (
            <circle
              className="score-ring-progress"
              cx={center}
              cy={center}
              r={radius}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
            />
          )}
        </svg>

        <div className="score-ring-content">
          <div className="score-value">
            {safeScore.toFixed(1)}
            <span className="score-value-max">/10</span>
          </div>
          <div className="score-label">{label}</div>
          {streak.current > 0 ? (
            <div className="streak-badge streak-badge-active">
              🔥 {streak.current}-Day Streak
            </div>
          ) : (
            <div className="streak-badge streak-badge-inactive">
              ⚡ Start Streak
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

