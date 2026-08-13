import { parseISO, differenceInCalendarDays, format, isAfter, isBefore, startOfDay, subDays } from 'date-fns';

export function calculateDailyScore(tasks) {
  if (!tasks || tasks.length === 0) {
    return { score: 0, breakdown: {}, baseScore: 0, bonus1: 0, bonus2: 0, penalty: 0 };
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  let totalTaskPoints = 0;
  let hasHighPriority = false;
  let allHighPriorityDone = true;
  let allDoneOnTime = true;
  let doneCount = 0;
  let missedCount = 0;
  let missedHighPriorityCount = 0;
  let evaluatedCount = 0;

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

    // Identify if task is carried over or upcoming (beyond today)
    const isCarried = Boolean(
      task.carriedOver ||
      task.carried_over ||
      task.wasCarried ||
      task.isCarried ||
      (task.originalDate && task.originalDate < todayStr) ||
      (task.original_date && task.original_date < todayStr)
    );

    const dueIso = task.dueDateTime || task.due_date_time;
    let isUpcoming = false;
    if (dueIso) {
      try {
        const dueObj = typeof dueIso === 'string' ? parseISO(dueIso) : new Date(dueIso);
        const dueDateStr = format(dueObj, 'yyyy-MM-dd');
        if (dueDateStr > todayStr) isUpcoming = true;
      } catch (e) {}
    }
    const taskDate = task.date ? (typeof task.date === 'string' ? task.date.trim().substring(0, 10) : '') : todayStr;
    if (taskDate && taskDate > todayStr) isUpcoming = true;

    const isOveredDay = taskDate < todayStr;

    if (task.status === 'done') {
      doneCount++;
      evaluatedCount++;
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
    } else if (task.status === 'missed') {
      missedCount++;
      allDoneOnTime = false;

      // If task has explicit rating badge (or user rated note), factor it in
      if (task.rating != null) {
        evaluatedCount++;
        totalTaskPoints += Number(task.rating);
      } 
      // If unrated missed task:
      // ONLY factor into score calculation if the day is OVERED (past date / finished day)!
      // On Today (active day), clean circle is shown without badge, so do NOT factor into score until rated or day is overed.
      else if (isOveredDay && !isCarried && !isUpcoming) {
        evaluatedCount++;
        totalTaskPoints += 0;
      }
    }
  }

  if (doneCount === 0 && missedCount === 0) {
    allDoneOnTime = false;
  }

  // Daily score is average across evaluated tasks (done + rated tasks + overed missed tasks) out of 10
  const baseScore = evaluatedCount > 0 ? totalTaskPoints / evaluatedCount : 0;
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
      missedCount,
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

function getCleanDateStr(rawDate) {
  if (!rawDate) return null;
  if (typeof rawDate === 'string') {
    const s = rawDate.trim();
    if (s.length >= 10) return s.substring(0, 10);
  }
  try {
    return format(new Date(rawDate), 'yyyy-MM-dd');
  } catch {
    return null;
  }
}

export function getAllValidStreakDates(archives = [], todayTasks = []) {
  const activeDates = new Set();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 1. Process archives
  (archives || []).forEach(arc => {
    if (!arc) return;
    const cleanD = getCleanDateStr(arc.date);
    let isArcValid = false;

    if (Array.isArray(arc.tasks) && arc.tasks.length > 0) {
      arc.tasks.forEach(t => {
        if (t && (t.status === 'done' || t.completedAt || t.completed_at)) {
          isArcValid = true;
          const tDate = getCleanDateStr(t.completedAt || t.completed_at || t.date || arc.date);
          if (tDate) activeDates.add(tDate);
        }
      });
    }

    if (isArcValid || arc.hasDone || (arc.score && Number(arc.score) > 0)) {
      if (cleanD) activeDates.add(cleanD);
    }
  });

  // 2. Process today's tasks
  if (Array.isArray(todayTasks) && todayTasks.length > 0) {
    const hasDoneToday = todayTasks.some(t => t && (t.status === 'done' || t.completedAt || t.completed_at));
    const todayScoreResult = calculateDailyScore(todayTasks);

    if (hasDoneToday || todayScoreResult.score > 0) {
      const sampleTask = todayTasks.find(t => t && (t.completedAt || t.date));
      const taskDate = sampleTask ? getCleanDateStr(sampleTask.completedAt || sampleTask.date) : todayStr;
      activeDates.add(taskDate || todayStr);
    }
  }

  return Array.from(activeDates).filter(Boolean).sort();
}

export function getStreakAsOfDate(archives = [], targetDateStr = null) {
  const effectiveTarget = targetDateStr
    ? (targetDateStr.includes('T') ? targetDateStr.split('T')[0] : targetDateStr.trim().substring(0, 10))
    : format(new Date(), 'yyyy-MM-dd');

  // Collect all active dates <= effectiveTarget
  const activeDatesSet = new Set();
  (archives || []).forEach(arc => {
    if (!arc || !arc.date) return;
    const cleanD = getCleanDateStr(arc.date);
    if (!cleanD || cleanD > effectiveTarget) return;

    let hasDoneTask = false;
    if (Array.isArray(arc.tasks) && arc.tasks.length > 0) {
      arc.tasks.forEach(t => {
        if (t && (t.status === 'done' || t.completedAt || t.completed_at)) {
          hasDoneTask = true;
          const tDate = getCleanDateStr(t.completedAt || t.completed_at || t.date || arc.date);
          if (tDate && tDate <= effectiveTarget) activeDatesSet.add(tDate);
        }
      });
    }

    const arcScore = Number(arc.score || 0);
    if (hasDoneTask || arc.hasDone || arcScore > 0) {
      activeDatesSet.add(cleanD);
    }
  });

  if (activeDatesSet.size === 0) {
    return { current: 0, isActive: false };
  }

  let checkDate = parseISO(effectiveTarget);
  if (isNaN(checkDate.getTime())) {
    checkDate = new Date();
  }

  const prevDate = subDays(checkDate, 1);

  // If effectiveTarget (e.g. today) has no completed tasks yet, streak for today is 0
  if (!activeDatesSet.has(effectiveTarget)) {
    return { current: 0, isActive: false };
  }

  let streakCount = 1;
  let isActive = true;
  let currCheckDate = prevDate;

  // Count backwards for consecutive active days prior to effectiveTarget
  while (true) {
    const dStr = format(currCheckDate, 'yyyy-MM-dd');
    if (activeDatesSet.has(dStr)) {
      streakCount++;
      currCheckDate = subDays(currCheckDate, 1);
    } else {
      break;
    }
  }

  return { current: streakCount, isActive };
}

export function getStreak(archives = [], todayTasks = []) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  return getStreakAsOfDate(archives, todayStr);
}

export function getBestStreak(archives = [], todayTasks = []) {
  const sortedDates = getAllValidStreakDates(archives, todayTasks);
  const currentStreakObj = getStreak(archives, todayTasks);
  const currentStreak = currentStreakObj.current || 0;

  if (sortedDates.length === 0) return 0;

  let maxStreak = 0;
  let currentRun = 0;
  let prevDateObj = null;

  for (const dateStr of sortedDates) {
    try {
      const currentDateObj = parseISO(dateStr);
      if (isNaN(currentDateObj.getTime())) continue;

      if (prevDateObj) {
        const diff = differenceInCalendarDays(currentDateObj, prevDateObj);
        if (diff === 1) {
          currentRun++;
        } else if (diff > 1) {
          currentRun = 1;
        }
      } else {
        currentRun = 1;
      }

      prevDateObj = currentDateObj;
      if (currentRun > maxStreak) {
        maxStreak = currentRun;
      }
    } catch {
      continue;
    }
  }

  return Math.max(currentStreak, maxStreak);
}

export function getCategoryCounts(archives = [], todayTasks = []) {
  const cats = { 'Work': 0, 'Learning': 0, 'Health': 0, 'Personal': 0 };
  const countedTaskIds = new Set();

  const processTask = (t) => {
    if (!t) return;
    const taskId = t.id || t._id;
    if (taskId && countedTaskIds.has(taskId)) return;
    if (taskId) countedTaskIds.add(taskId);

    const isDone = t.status === 'done';
    if (!isDone) return;

    const rawCat = (t.category || '').trim();
    if (!rawCat) {
      cats['Personal'] = (cats['Personal'] || 0) + 1;
      return;
    }

    const standardMatch = Object.keys(cats).find(c => c.toLowerCase() === rawCat.toLowerCase());
    if (standardMatch) {
      cats[standardMatch] = (cats[standardMatch] || 0) + 1;
    } else {
      const formattedCat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();
      cats[formattedCat] = (cats[formattedCat] || 0) + 1;
    }
  };

  (archives || []).forEach(arc => {
    if (arc && Array.isArray(arc.tasks)) {
      arc.tasks.forEach(processTask);
    }
  });

  (todayTasks || []).forEach(processTask);

  // Fallback: If no completed tasks exist yet, process ALL tasks regardless of status
  if (Object.values(cats).reduce((a, b) => a + b, 0) === 0) {
    const processAnyTask = (t) => {
      if (!t) return;
      const rawCat = (t.category || '').trim();
      const standardMatch = Object.keys(cats).find(c => c.toLowerCase() === rawCat.toLowerCase());
      if (standardMatch) {
        cats[standardMatch] = (cats[standardMatch] || 0) + 1;
      } else if (rawCat) {
        const formattedCat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();
        cats[formattedCat] = (cats[formattedCat] || 0) + 1;
      } else {
        cats['Work'] = (cats['Work'] || 0) + 1;
      }
    };

    (archives || []).forEach(arc => {
      if (arc && Array.isArray(arc.tasks)) arc.tasks.forEach(processAnyTask);
    });
    (todayTasks || []).forEach(processAnyTask);
  }

  return cats;
}

export function getMostProductiveCategory(archives = [], todayTasks = []) {
  const cats = getCategoryCounts(archives, todayTasks);
  let bestCategory = 'N/A';
  let maxCount = 0;

  for (const [category, count] of Object.entries(cats)) {
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
