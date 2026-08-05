import { useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { saveTasks } from '../store/store';

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
            const notes = Array.isArray(task.daily_notes || task.dailyNotes) ? (task.daily_notes || task.dailyNotes) : [];
            const ratedNotes = notes.filter(n => n && n.rating != null && Number(n.rating) > 0 && !n.isAutoMissed);

            if (notes.length > 0) {
              const totalSum = notes.reduce((sum, n) => {
                const r = parseFloat(n ? (n.rating != null ? n.rating : (n.score != null ? n.score : 0)) : 0);
                return sum + (isNaN(r) ? 0 : Math.max(0, r));
              }, 0);
              const avgRating = Math.round((totalSum / notes.length) * 10) / 10;
              return {
                ...task,
                status: 'done',
                rating: avgRating,
                completedAt: task.completedAt || now.toISOString(),
                completed_at: task.completed_at || now.toISOString()
              };
            } else {
              return { ...task, status: 'missed' };
            }
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
