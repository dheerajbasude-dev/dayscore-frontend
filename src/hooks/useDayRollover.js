import { useEffect, useRef } from 'react';
import { format } from 'date-fns';

export function useDayRollover(currentDateStr, tasks, onRollover, onTasksUpdated) {
  const lastSystemDateRef = useRef(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const interval = setInterval(() => {
      const actualSystemDate = format(new Date(), 'yyyy-MM-dd');
      // ONLY trigger onRollover when real clock time crosses midnight (system date changes)
      if (actualSystemDate !== lastSystemDateRef.current) {
        lastSystemDateRef.current = actualSystemDate;
        if (onRollover) {
          onRollover();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [onRollover]);

  return {};
}
