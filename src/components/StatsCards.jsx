import React from 'react';

export default function StatsCards({ 
  currentStreak = 0, 
  bestStreak = 0, 
  avgScore = 0, 
  totalDone = 0, 
  bestCategory = 'N/A', 
  missedTime = 'N/A' 
}) {
  const stats = [
    { label: 'Current Streak', value: `${currentStreak}`, unit: 'days', icon: '🔥' },
    { label: 'Best Streak', value: `${bestStreak}`, unit: 'days', icon: '🏆' },
    { label: 'Avg Score', value: `${avgScore.toFixed(1)}`, unit: '/10', icon: '📊' },
    { label: 'Tasks Done', value: `${totalDone}`, unit: '', icon: '✅' },
    { label: 'Top Category', value: bestCategory, unit: '', icon: '💪' },
    { label: 'Most Missed', value: missedTime, unit: '', icon: '⏰' }
  ];

  return (
    <div className="stats-grid">
      {stats.map((stat, i) => (
        <div 
          key={i} 
          className="stat-card animate-slide-up" 
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          <div className="stat-icon">{stat.icon}</div>
          <div className="stat-value">
            {stat.value}
            {stat.unit && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600' }}>{stat.unit}</span>}
          </div>
          <div className="stat-label">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
