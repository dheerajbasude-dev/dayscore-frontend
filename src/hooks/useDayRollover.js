import { useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { saveTasks } from '../store/store';

export function useDayRollover(currentDateStr, tasks, onRollover) {
  const checkAndMarkMissed = useCallback(() => {
    let tasksUpdated = false;
    const now = new Date();
    
    if (tasks && tasks.length > 0) {
      const updatedTasks = tasks.map(task => {
        if ((task.status === 'pending' || task.status === 'inprogress') && task.dueDateTime) {
          if (new Date(task.dueDateTime) < now) {
            tasksUpdated = true;
            return { ...task, status: 'missed' };
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
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      if (todayStr !== currentDateStr) {
        onRollover();
      } else {
        checkAndMarkMissed();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentDateStr, checkAndMarkMissed, onRollover]);

  return { checkAndMarkMissed };
}
