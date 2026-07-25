import { useState, useEffect } from 'react';

export function useTimer(dueDateTime) {
  const [timeLeftInfo, setTimeLeftInfo] = useState({
    timeLeft: '',
    totalMs: 0,
    color: 'gray',
    urgencyClass: 'timer-safe',
    isOverdue: false
  });

  useEffect(() => {
    if (!dueDateTime) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const due = new Date(dueDateTime).getTime();
      const difference = due - now;

      if (difference <= 0) {
        setTimeLeftInfo({
          timeLeft: '0h 0m 0s',
          totalMs: 0,
          color: 'gray',
          urgencyClass: 'timer-missed',
          isOverdue: true
        });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      let timeLeftStr;
      if (days >= 365) {
        const years = Math.floor(days / 365);
        const remMonths = Math.floor((days % 365) / 30);
        timeLeftStr = remMonths > 0 ? `${years}yr ${remMonths}mo` : `${years} ${years === 1 ? 'Year' : 'Years'}`;
      } else if (days >= 30) {
        const months = Math.floor(days / 30);
        const remDays = days % 30;
        timeLeftStr = remDays > 0 ? `${months}mo ${remDays}d` : `${months} ${months === 1 ? 'Month' : 'Months'}`;
      } else if (hours >= 24) {
        const remHours = hours % 24;
        timeLeftStr = remHours > 0 ? `${days}d ${remHours}h` : `${days} ${days === 1 ? 'Day' : 'Days'}`;
      } else {
        timeLeftStr = `${hours}h ${minutes}m ${seconds}s`;
      }

      let color = 'green';
      let urgencyClass = 'timer-safe';

      if (hours < 2 && hours > 0 || (hours === 0 && minutes >= 30)) {
        color = 'yellow';
        urgencyClass = 'timer-warning';
      } else if (hours === 0 && minutes < 30) {
        color = 'red';
        urgencyClass = 'timer-danger';
      }

      setTimeLeftInfo({
        timeLeft: timeLeftStr,
        totalMs: difference,
        color,
        urgencyClass,
        isOverdue: false
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [dueDateTime]);

  return timeLeftInfo;
}
