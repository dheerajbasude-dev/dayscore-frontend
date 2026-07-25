import React, { useState, useEffect } from 'react';
import { format, endOfDay, differenceInMilliseconds, startOfDay } from 'date-fns';

export default function GlobalClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = format(now, 'h:mm:ss a');
  const dateString = format(now, 'EEEE, MMMM d, yyyy');
  
  const end = endOfDay(now);
  const start = startOfDay(now);
  
  const msRemaining = differenceInMilliseconds(end, now);
  const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
  
  const totalDayMs = differenceInMilliseconds(end, start);
  const msElapsed = differenceInMilliseconds(now, start);
  const progressPercent = Math.min(100, Math.max(0, (msElapsed / totalDayMs) * 100));

  return (
    <div className="global-clock">
      <div className="clock-info">
        <div>
          <div className="clock-time">{timeString}</div>
          <div className="clock-date">{dateString}</div>
        </div>
        <div className="clock-left">
          ⏳ {hoursRemaining}h {minutesRemaining}m remaining
        </div>
      </div>
      <div className="day-progress-track">
        <div 
          className="day-progress-bar" 
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
