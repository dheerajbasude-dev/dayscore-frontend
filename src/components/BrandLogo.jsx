import React from 'react';

export default function BrandLogo({ size = 'medium', className = '' }) {
  return (
    <div className={`dayscore-brand-logo ${size} ${className}`}>
      <div className="brand-logo-icon-wrapper">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="brand-logo-svg">
          <defs>
            <linearGradient id="brandRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="50%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
            <linearGradient id="brandLightningGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="50%" stopColor="#818CF8" />
              <stop offset="100%" stopColor="#C084FC" />
            </linearGradient>
          </defs>
          <circle cx="256" cy="256" r="210" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="32" />
          <circle cx="256" cy="256" r="210" fill="none" stroke="url(#brandRingGrad)" strokeWidth="32" strokeLinecap="round" strokeDasharray="1318" strokeDashoffset="280" transform="rotate(-90 256 256)" />
          <path d="M 285 105 L 185 260 L 250 260 L 215 405 L 335 235 L 268 235 Z" fill="url(#brandLightningGrad)" stroke="#FFFFFF" strokeWidth="8" strokeLinejoin="round" />
          <circle cx="345" cy="135" r="20" fill="#F59E0B" />
        </svg>
      </div>
      <span className="brand-logo-text">
        <span className="brand-text-day">Day</span>
        <span className="brand-text-score">Score</span>
      </span>
    </div>
  );
}
