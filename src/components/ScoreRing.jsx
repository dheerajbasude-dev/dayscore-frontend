import React from 'react';

export default function ScoreRing({ 
  score = 0, 
  streak = { current: 0, isActive: false }, 
  averages = { week: 0, month: 0, allTime: 0 },
  details = {}
}) {
  const radius = 70;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const size = (radius + strokeWidth) * 2;
  const center = size / 2;

  // 1. Daily Score Ring
  const safeDailyScore = Math.max(0, Math.min(10, Number(score) || 0));
  const dailyOffset = circumference - (safeDailyScore / 10) * circumference;

  let dailyStrokeColor = 'var(--accent-success)';
  if (safeDailyScore < 4) {
    dailyStrokeColor = 'var(--accent-danger)';
  } else if (safeDailyScore < 7) {
    dailyStrokeColor = 'var(--accent-warning)';
  }

  // 2. Total Average Score Ring
  const safeAvgScore = Math.max(0, Math.min(10, Number(averages.allTime || averages.month || 0) || 0));
  const avgOffset = circumference - (safeAvgScore / 10) * circumference;

  let avgStrokeColor = 'var(--accent-primary)';
  if (safeAvgScore < 4) {
    avgStrokeColor = 'var(--accent-danger)';
  } else if (safeAvgScore < 7) {
    avgStrokeColor = 'var(--accent-warning)';
  } else {
    avgStrokeColor = 'var(--accent-success)';
  }

  return (
    <div className="card-glass score-ring-card">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '32px', width: '100%' }}>
        
        {/* Daily Score Ring */}
        <div className="score-ring-wrapper" style={{ width: '180px', height: '180px' }}>
          <svg className="score-ring-svg" viewBox={`0 0 ${size} ${size}`}>
            <circle
              className="score-ring-bg"
              cx={center}
              cy={center}
              r={radius}
              strokeWidth={strokeWidth}
            />
            {safeDailyScore > 0 && (
              <circle
                className="score-ring-progress"
                cx={center}
                cy={center}
                r={radius}
                stroke={dailyStrokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={dailyOffset}
                transform={`rotate(-90 ${center} ${center})`}
              />
            )}
          </svg>

          <div className="score-ring-content">
            <div className="score-value" style={{ fontSize: '1.8rem' }}>
              {safeDailyScore.toFixed(1)}
              <span className="score-value-max" style={{ fontSize: '0.9rem' }}>/10</span>
            </div>
            <div className="score-label" style={{ fontSize: '0.8rem', fontWeight: '600' }}>Daily Score</div>
            {streak.current > 0 ? (
              <div className="streak-badge streak-badge-active" style={{ fontSize: '0.75rem', padding: '2px 8px', marginTop: '4px' }}>
                🔥 {streak.current} {streak.current === 1 ? 'Day' : 'Days'} Streak
              </div>
            ) : (
              <div className="streak-badge streak-badge-inactive" style={{ fontSize: '0.75rem', padding: '2px 8px', marginTop: '4px' }}>
                ⚡ No Streak
              </div>
            )}
          </div>
        </div>

        {/* Total Average Score Ring */}
        <div className="score-ring-wrapper" style={{ width: '180px', height: '180px' }}>
          <svg className="score-ring-svg" viewBox={`0 0 ${size} ${size}`}>
            <circle
              className="score-ring-bg"
              cx={center}
              cy={center}
              r={radius}
              strokeWidth={strokeWidth}
            />
            {safeAvgScore > 0 && (
              <circle
                className="score-ring-progress"
                cx={center}
                cy={center}
                r={radius}
                stroke={avgStrokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={avgOffset}
                transform={`rotate(-90 ${center} ${center})`}
              />
            )}
          </svg>

          <div className="score-ring-content">
            <div className="score-value" style={{ fontSize: '1.8rem' }}>
              {safeAvgScore.toFixed(1)}
              <span className="score-value-max" style={{ fontSize: '0.9rem' }}>/10</span>
            </div>
            <div className="score-label" style={{ fontSize: '0.8rem', fontWeight: '600' }}>Total Avg Score</div>
            <div className="streak-badge" style={{ fontSize: '0.75rem', padding: '2px 8px', marginTop: '4px', background: 'rgba(129, 140, 248, 0.15)', color: 'var(--accent-primary)', border: '1px solid rgba(129, 140, 248, 0.3)' }}>
              📊 {Number(averages.month || 0).toFixed(1)} (30d Avg)
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

