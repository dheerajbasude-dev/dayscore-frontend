import { useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { saveTasks } from '../store/store';
import { calculateTaskAutoRating } from '../pages/TodayView';

export function useDayRollover(currentDateStr, tasks, onRollover) {
  const lastSystemDateRef = useRef(format(new Date(), 'yyyy-MM-dd'));

  const checkAndMarkMissed = useCallback(() => {
    let tasksUpdated = false;
    const now = new Date();
    
    if (tasks && tasks.length > 0) {
      const updatedTasks = tasks.map(task => {
        if ((task.status === 'pending' || task.status === 'inprogress') && task.dueDateTime) {
          if (new Date(task.dueDateTime) < now) {
            tasksUpdated = true;
            const { avgRating } = calculateTaskAutoRating(task);

            return {
              ...task,
              status: 'done',
              completed: true,
              rating: avgRating,
              completedAt: task.completedAt || now.toISOString(),
              completed_at: task.completed_at || now.toISOString()
            };
          }
        }
        return task;
      });

      if (tasksUpdated) {
        saveTasks(currentDateStr, updatedTasks);
      }
    }
  }, [currentDateStr, tasks]);

  useEffect(() => {
    const interval = setInterval(() => {
      const actualSystemDate = format(new Date(), 'yyyy-MM-dd');
      // ONLY trigger onRollover when real clock time crosses midnight (system date changes)
      if (actualSystemDate !== lastSystemDateRef.current) {
        lastSystemDateRef.current = actualSystemDate;
        onRollover();
      } else if (currentDateStr === actualSystemDate) {
        checkAndMarkMissed();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [currentDateStr, checkAndMarkMissed, onRollover]);

  return { checkAndMarkMissed };
}
