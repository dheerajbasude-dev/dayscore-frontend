import React, { useId } from 'react';

export default function BrandLogo({ size = 'medium', className = '' }) {
  const uniqueId = useId().replace(/:/g, '');
  const ringGradId = `brandRingGrad_${uniqueId}`;
  const boltGradId = `brandBoltGrad_${uniqueId}`;

  return (
    <div className={`dayscore-brand-logo ${size} ${className}`}>
      <div className="brand-logo-icon-wrapper">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="brand-logo-svg">
          <defs>
            <linearGradient id={ringGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818CF8" />
              <stop offset="50%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
            <linearGradient id={boltGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFBEB" />
              <stop offset="40%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>

          {/* Background Outer Ring Track */}
          <circle 
            cx="50" 
            cy="50" 
            r="38" 
            fill="none" 
            stroke="rgba(255, 255, 255, 0.2)" 
            strokeWidth="7" 
          />

          {/* Active Score Ring Progress Arc */}
          <circle 
            cx="50" 
            cy="50" 
            r="38" 
            fill="none" 
            stroke={`url(#${ringGradId})`} 
            strokeWidth="7" 
            strokeLinecap="round" 
            strokeDasharray="238.76" 
            strokeDashoffset="55" 
            transform="rotate(-90 50 50)" 
          />

          {/* High-Detail Sharp Golden Lightning Bolt */}
          <path 
            d="M 54 18 L 34 49 L 48 49 L 42 82 L 68 45 L 52 45 Z" 
            fill={`url(#${boltGradId})`} 
            stroke="#FFFFFF" 
            strokeWidth="2" 
            strokeLinejoin="round" 
          />

          {/* Streak Spark Orb at Top Right */}
          <circle 
            cx="75" 
            cy="24" 
            r="5.5" 
            fill="#F59E0B" 
            stroke="#FFFFFF" 
            strokeWidth="2" 
          />
        </svg>
      </div>
      <span className="brand-logo-text">
        <span className="brand-text-day">Day</span>
        <span className="brand-text-score">Score</span>
      </span>
    </div>
  );
}
