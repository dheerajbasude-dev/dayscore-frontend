import { parseISO, differenceInCalendarDays, format, isAfter, isBefore, startOfDay, subDays } from 'date-fns';

export function calculateDailyScore(tasks) {
  if (!tasks || tasks.length === 0) {
    return { score: 0, breakdown: {}, baseScore: 0, bonus1: 0, bonus2: 0, penalty: 0 };
  }

  let totalTaskPoints = 0;
  let hasHighPriority = false;
  let allHighPriorityDone = true;
  let allDoneOnTime = true;
  let doneCount = 0;
  let missedHighPriorityCount = 0;

  for (const task of tasks) {
    if (task.priority === 'High') {
      hasHighPriority = true;
      if (task.status !== 'done') {
        allHighPriorityDone = false;
      }
      if (task.status === 'missed') {
        missedHighPriorityCount++;
      }
    }

    if (task.status === 'done') {
      doneCount++;
      // Take task rating directly without any ratio calculation
      if (task.rating != null) {
        totalTaskPoints += Number(task.rating);
      } else {
        totalTaskPoints += 10;
      }
      if (task.dueDateTime && task.completedAt) {
        if (isAfter(parseISO(task.completedAt), parseISO(task.dueDateTime))) {
          allDoneOnTime = false;
        }
      }
    }
  }

  if (doneCount === 0) {
    allDoneOnTime = false;
  }

  // Daily score is exact average of completed tasks (out of 10)
  const baseScore = doneCount > 0 ? totalTaskPoints / doneCount : 0;
  const finalScore = Math.min(10, Math.max(0, baseScore));

  return {
    score: Number(finalScore.toFixed(1)),
    baseScore: Number(baseScore.toFixed(1)),
    bonus1: 0,
    bonus2: 0,
    penalty: 0,
    breakdown: {
      totalTasks: tasks.length,
      doneCount,
      missedHighPriorityCount,
      allDoneOnTime
    }
  };
}

export function calculateOverallAverageTaskScore(archives = [], todayTasks = []) {
  const allTasksMap = new Map();

  (archives || []).forEach(a => {
    if (a && Array.isArray(a.tasks)) {
      a.tasks.forEach(t => {
        const id = t.id || t._id;
        if (id) allTasksMap.set(id, t);
      });
    }
  });

  (todayTasks || []).forEach(t => {
    const id = t.id || t._id;
    if (id) allTasksMap.set(id, t);
  });

  const allCompleted = Array.from(allTasksMap.values()).filter(t => t.status === 'done');
  if (allCompleted.length === 0) return 0;

  const totalPoints = allCompleted.reduce((sum, t) => {
    return sum + (t.rating != null ? Number(t.rating) : 10);
  }, 0);

  return Number((totalPoints / allCompleted.length).toFixed(1));
}

export function getRollingAverage(archives = [], days = 0, todayTasks = []) {
  if (days === 0) {
    return calculateOverallAverageTaskScore(archives, todayTasks);
  }

  const validArchives = (archives || []).filter(a => a && a.date && typeof a.date === 'string');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  const archiveMap = new Map();
  validArchives.forEach(a => {
    const cleanDate = a.date.includes('T') ? a.date.split('T')[0] : a.date.trim().substring(0, 10);
    let scoreVal = Number(a.score) || 0;
    if (!scoreVal && Array.isArray(a.tasks) && a.tasks.length > 0) {
      scoreVal = calculateDailyScore(a.tasks).score;
    }
    archiveMap.set(cleanDate, scoreVal);
  });

  if (Array.isArray(todayTasks) && todayTasks.length > 0) {
    const todayResult = calculateDailyScore(todayTasks);
    if (todayResult.score > 0) {
      archiveMap.set(todayStr, todayResult.score);
    }
  }

  if (archiveMap.size === 0) return 0;

  const today = startOfDay(new Date());
  const cutoffDate = subDays(today, days);

  let totalScore = 0;
  let count = 0;

  for (const [dateStr, score] of archiveMap.entries()) {
    if (!score || score <= 0) continue;
    try {
      const archiveDate = parseISO(dateStr);
      if (isNaN(archiveDate.getTime())) continue;
      if (isAfter(archiveDate, cutoffDate) || archiveDate.getTime() === cutoffDate.getTime()) {
        totalScore += score;
        count++;
      }
    } catch {
      continue;
    }
  }

  if (count === 0) return 0;
  return Number((totalScore / count).toFixed(1));
}

const isValidStreakDay = (entry) => {
  if (!entry) return false;
  if (entry.tasks && Array.isArray(entry.tasks)) {
    const hasAddedTask = entry.tasks.length > 0;
    const hasCompletedTask = entry.tasks.some(t => t.status === 'done');
    return hasAddedTask && hasCompletedTask;
  }
  return Boolean(entry.hasDone || (entry.score && entry.score > 0));
};

export function getStreak(archives = [], todayTasks = []) {
  const validArchives = (archives || []).filter(a => a && a.date && typeof a.date === 'string');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  const archiveMap = new Map();
  validArchives.forEach(a => {
    if (isValidStreakDay(a)) {
      archiveMap.set(a.date, a);
    }
  });

  const hasDoneToday = Array.isArray(todayTasks) && todayTasks.length > 0 && todayTasks.some(t => t.status === 'done');
  const todayScoreResult = calculateDailyScore(todayTasks || []);
  
  if (hasDoneToday || (todayTasks.length > 0 && todayScoreResult.score > 0)) {
    archiveMap.set(todayStr, {
      date: todayStr,
      score: todayScoreResult.score,
      tasks: todayTasks,
      hasDone: true
    });
  }

  let streakCount = 0;
  let isActive = false;
  let checkDate = new Date();

  // Check today first
  const todayEntry = archiveMap.get(todayStr);
  if (todayEntry && isValidStreakDay(todayEntry)) {
    isActive = true;
    streakCount++;
    checkDate = subDays(checkDate, 1);
  } else {
    // Check yesterday to keep streak active if today isn't completed yet
    const yesterdayStr = format(subDays(checkDate, 1), 'yyyy-MM-dd');
    const yesterdayEntry = archiveMap.get(yesterdayStr);
    if (yesterdayEntry && isValidStreakDay(yesterdayEntry)) {
      isActive = true;
      checkDate = subDays(checkDate, 1);
    } else {
      return { current: 0, isActive: false };
    }
  }

  // Count consecutive past days
  while (true) {
    const dateKey = format(checkDate, 'yyyy-MM-dd');
    const entry = archiveMap.get(dateKey);
    if (entry && isValidStreakDay(entry)) {
      streakCount++;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  return { current: streakCount, isActive };
}

export function getBestStreak(archives = [], todayTasks = []) {
  const currentStreakObj = getStreak(archives, todayTasks);
  const currentStreak = currentStreakObj.current || 0;

  const validArchives = (archives || []).filter(a => a && a.date && typeof a.date === 'string');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  const archiveMap = new Map();
  validArchives.forEach(a => {
    if (isValidStreakDay(a)) {
      archiveMap.set(a.date, a);
    }
  });

  const hasDoneToday = Array.isArray(todayTasks) && todayTasks.length > 0 && todayTasks.some(t => t.status === 'done');
  const todayScoreResult = calculateDailyScore(todayTasks || []);
  if (hasDoneToday || (todayTasks.length > 0 && todayScoreResult.score > 0)) {
    archiveMap.set(todayStr, {
      date: todayStr,
      score: todayScoreResult.score,
      tasks: todayTasks,
      hasDone: true
    });
  }

  const sortedDates = Array.from(archiveMap.keys()).sort();
  let maxStreak = 0;
  let runningStreak = 0;
  let prevDate = null;

  for (const dateStr of sortedDates) {
    const entry = archiveMap.get(dateStr);
    if (entry && isValidStreakDay(entry)) {
      try {
        const currentDate = parseISO(dateStr);
        if (prevDate) {
          const diff = differenceInCalendarDays(currentDate, prevDate);
          if (diff === 1) {
            runningStreak++;
          } else {
            runningStreak = 1;
          }
        } else {
          runningStreak = 1;
        }
        prevDate = currentDate;
        if (runningStreak > maxStreak) {
          maxStreak = runningStreak;
        }
      } catch {
        continue;
      }
    }
  }

  return Math.max(currentStreak, maxStreak);
}

export function getMostProductiveCategory(archives) {
  if (!archives || archives.length === 0) return 'N/A';
  
  const counts = {};
  const countedTaskIds = new Set();

  for (const archive of archives) {
    if (archive.tasks) {
      for (const task of archive.tasks) {
        if (task.status === 'done' && task.category) {
          const taskId = task.id || task._id;
          if (taskId && !countedTaskIds.has(taskId)) {
            countedTaskIds.add(taskId);
            counts[task.category] = (counts[task.category] || 0) + 1;
          } else if (!taskId) {
            counts[task.category] = (counts[task.category] || 0) + 1;
          }
        }
      }
    }
  }
  
  let bestCategory = 'N/A';
  let maxCount = 0;
  for (const [category, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      bestCategory = category;
    }
  }
  
  return bestCategory;
}

export function getMostMissedTimeOfDay(archives) {
  if (!archives || archives.length === 0) return 'N/A';
  
  const hourCounts = {};
  for (const archive of archives) {
    if (archive.tasks) {
      for (const task of archive.tasks) {
        if (task.status === 'missed' && task.dueDateTime) {
          const date = parseISO(task.dueDateTime);
          const hour = date.getHours();
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }
      }
    }
  }
  
  let bestHour = -1;
  let maxCount = 0;
  for (const [hourStr, count] of Object.entries(hourCounts)) {
    if (count > maxCount) {
      maxCount = count;
      bestHour = parseInt(hourStr, 10);
    }
  }
  
  if (bestHour === -1) return 'N/A';
  
  const period = bestHour >= 12 ? 'PM' : 'AM';
  const displayHour1 = bestHour % 12 === 0 ? 12 : bestHour % 12;
  const nextHour = (bestHour + 1) % 24;
  const nextPeriod = nextHour >= 12 ? 'PM' : 'AM';
  const displayHour2 = nextHour % 12 === 0 ? 12 : nextHour % 12;
  
  return `${displayHour1} ${period} - ${displayHour2} ${nextPeriod}`;
}

export function getTotalTasksDone(archives) {
  if (!archives || archives.length === 0) return 0;
  
  const completedTaskIds = new Set();
  let total = 0;
  for (const archive of archives) {
    if (archive.tasks) {
      for (const t of archive.tasks) {
        if (t.status === 'done') {
          const taskId = t.id || t._id;
          if (taskId && !completedTaskIds.has(taskId)) {
            completedTaskIds.add(taskId);
            total++;
          } else if (!taskId) {
            total++;
          }
        }
      }
    }
  }
  return total;
}
