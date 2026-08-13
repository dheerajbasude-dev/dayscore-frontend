import { useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { saveTasks } from '../store/store';
import { calculateTaskAutoRating } from '../pages/TodayView';

export function useDayRollover(currentDateStr, tasks, onRollover, onTaskUpdate) {
  const lastSystemDateRef = useRef(format(new Date(), 'yyyy-MM-dd'));

  const checkAndMarkMissed = useCallback(() => {
    let tasksUpdated = false;
    const now = new Date();
    
    if (tasks && tasks.length > 0) {
      const updatedTasks = tasks.map(task => {
        if ((task.status === 'pending' || task.status === 'inprogress') && task.dueDateTime) {
          if (new Date(task.dueDateTime) < now) {
            tasksUpdated = true;
            const { hasRatedNote, avgRating } = calculateTaskAutoRating(task);

            const statusVal = hasRatedNote ? 'done' : 'missed';
            return {
              ...task,
              status: statusVal,
              completed: statusVal === 'done',
              rating: hasRatedNote ? avgRating : 0,
              completedAt: statusVal === 'done' ? (task.completedAt || now.toISOString()) : null,
              completed_at: statusVal === 'done' ? (task.completed_at || now.toISOString()) : null
            };
          }
        }
        return task;
      });

      if (tasksUpdated) {
        saveTasks(currentDateStr, updatedTasks);
        if (onTaskUpdate && typeof onTaskUpdate === 'function') {
          onTaskUpdate(updatedTasks);
        }
      }
    }
  }, [currentDateStr, tasks, onTaskUpdate]);

  useEffect(() => {
    const actualSystemDate = format(new Date(), 'yyyy-MM-dd');
    if (currentDateStr === actualSystemDate) {
      checkAndMarkMissed();
    }

    const interval = setInterval(() => {
      const nowSystemDate = format(new Date(), 'yyyy-MM-dd');
      // ONLY trigger onRollover when real clock time crosses midnight (system date changes)
      if (nowSystemDate !== lastSystemDateRef.current) {
        lastSystemDateRef.current = nowSystemDate;
        onRollover();
      } else if (currentDateStr === nowSystemDate) {
        checkAndMarkMissed();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [currentDateStr, checkAndMarkMissed, onRollover]);

  return { checkAndMarkMissed };
}
