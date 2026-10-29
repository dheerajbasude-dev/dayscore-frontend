import { parseISO, differenceInCalendarDays, format, isAfter, isBefore, startOfDay, subDays, addDays } from 'date-fns';
import { calculateTaskAutoRating, getLocalDateStr, isDateOnLeave, getLeaveReasonForDate, getDailyRingScores, saveDailyRingScore } from '../utils/taskUtils.js';

export { isDateOnLeave, getLeaveReasonForDate, getDailyRingScores, saveDailyRingScore };

export function calculateDailyScore(tasks, targetDateStr = null) {
  if (!tasks || tasks.length === 0) {
    return { score: 0, breakdown: {}, baseScore: 0, bonus1: 0, bonus2: 0, penalty: 0 };
  }

  const effectiveTargetDate = targetDateStr
    ? (typeof targetDateStr === 'string' ? targetDateStr.trim().substring(0, 10) : format(new Date(), 'yyyy-MM-dd'))
    : format(new Date(), 'yyyy-MM-dd');

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

    if (task.status === 'done') {
      doneCount++;
      if (task.rating != null && !isNaN(Number(task.rating)) && Number(task.rating) > 0) {
        evaluatedCount++;
        totalTaskPoints += Number(task.rating);
      }
      if (task.dueDateTime && task.completedAt) {
        try {
          const compDate = parseISO(task.completedAt);
          const dueDate = parseISO(task.dueDateTime);
          if (!isNaN(compDate.getTime()) && !isNaN(dueDate.getTime())) {
            if (isAfter(compDate, dueDate)) {
              allDoneOnTime = false;
            }
          }
        } catch (e) {}
      }
    } else if (task.status === 'missed' || task.missed === true || task.wasMissed === true || task.was_missed === true) {
      missedCount++;
      allDoneOnTime = false;

      // Missed task: auto-considers 0 score (or rating if explicitly rated)
      evaluatedCount++;
      totalTaskPoints += (task.rating != null && !isNaN(Number(task.rating))) ? Number(task.rating) : 0;
    } else {
      // In-progress / pending task:
      // Include its current in-progress average score (from rated daily notes) in the ring score.
      // When today's note is rated/updated today, calculateTaskAutoRating automatically reflects today's new rating.
      const { hasRatedNote, avgRating } = calculateTaskAutoRating(task, effectiveTargetDate);
      if (hasRatedNote && avgRating != null && !isNaN(avgRating) && avgRating > 0) {
        evaluatedCount++;
        totalTaskPoints += Number(avgRating);
      } else if (task.rating != null && !isNaN(Number(task.rating)) && Number(task.rating) > 0) {
        evaluatedCount++;
        totalTaskPoints += Number(task.rating);
      }
    }
  }

  if (doneCount === 0 && missedCount === 0) {
    allDoneOnTime = false;
  }

  // Daily score is average across evaluated tasks out of 10
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
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  (archives || []).forEach(a => {
    if (a && Array.isArray(a.tasks)) {
      const arcDate = a.date ? (typeof a.date === 'string' ? a.date.trim().substring(0, 10) : '') : '';
      a.tasks.forEach(t => {
        const id = t.id || t._id;
        if (id) allTasksMap.set(id, { ...t, date: t.date || arcDate });
      });
    }
  });

  (todayTasks || []).forEach(t => {
    const id = t.id || t._id;
    if (id) allTasksMap.set(id, { ...t, date: t.date || todayStr });
  });

  const allTasks = Array.from(allTasksMap.values());
  if (allTasks.length === 0) return 0;

  let totalTaskPoints = 0;
  let evaluatedCount = 0;

  for (const task of allTasks) {
    if (task.status === 'done') {
      if (task.rating != null && !isNaN(Number(task.rating)) && Number(task.rating) > 0) {
        evaluatedCount++;
        totalTaskPoints += Number(task.rating);
      }
    } else if (task.status === 'missed' || task.missed === true || task.wasMissed === true || task.was_missed === true) {
      evaluatedCount++;
      totalTaskPoints += (task.rating != null && !isNaN(Number(task.rating))) ? Number(task.rating) : 0;
    } else {
      const { hasRatedNote, avgRating } = calculateTaskAutoRating(task, todayStr);
      if (hasRatedNote && avgRating != null && !isNaN(avgRating) && avgRating > 0) {
        evaluatedCount++;
        totalTaskPoints += Number(avgRating);
      } else if (task.rating != null && !isNaN(Number(task.rating)) && Number(task.rating) > 0) {
        evaluatedCount++;
        totalTaskPoints += Number(task.rating);
      }
    }
  }

  if (evaluatedCount === 0) return 0;
  const baseScore = totalTaskPoints / evaluatedCount;
  const finalScore = Math.min(10, Math.max(0, baseScore));
  return Number(finalScore.toFixed(1));
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
    let scoreVal = a.score !== undefined && a.score !== null ? Number(a.score) : null;
    if (scoreVal === null && Array.isArray(a.tasks) && a.tasks.length > 0) {
      scoreVal = calculateDailyScore(a.tasks).score;
    }
    if (scoreVal !== null && !isNaN(scoreVal)) {
      archiveMap.set(cleanDate, scoreVal);
    }
  });

  if (Array.isArray(todayTasks) && todayTasks.length > 0) {
    const todayResult = calculateDailyScore(todayTasks);
    if (todayResult.breakdown.doneCount > 0 || todayResult.breakdown.missedCount > 0) {
      archiveMap.set(todayStr, todayResult.score);
    }
  }

  if (archiveMap.size === 0) return 0;

  const today = startOfDay(new Date());
  const cutoffDate = subDays(today, days);

  let totalScore = 0;
  let count = 0;

  for (const [dateStr, score] of archiveMap.entries()) {
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

export function getMissedDatesSet(archives = [], todayTasks = [], effectiveTarget = null) {
  const missedDates = new Set();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const targetStr = effectiveTarget || todayStr;
  const now = new Date();

  const isTaskOverdue = (t) => {
    if (!t) return false;
    const dueDateStr = t.dueDateTime || t.due_date_time;
    if (dueDateStr) {
      const dueObj = new Date(dueDateStr);
      if (!isNaN(dueObj.getTime())) {
        return dueObj <= now;
      }
    }
    const taskDate = getCleanDateStr(t.date || t.dateLabel);
    if (taskDate) {
      return taskDate < todayStr;
    }
    return false;
  };

  const processTask = (t, defaultDate) => {
    if (!t) return;
    const taskDate = getCleanDateStr(t.date || defaultDate);
    const isDone = t.status === 'done' || t.completed === true;

    // 1. Normal task marked missed or overdue
    if (!isDone) {
      if (t.status === 'missed' || t.missed === true || t.wasMissed === true || t.was_missed === true) {
        if (taskDate && taskDate <= targetStr) missedDates.add(taskDate);
      } else if (taskDate && taskDate < todayStr && taskDate <= targetStr) {
        // Any past scheduled task not completed is missed
        missedDates.add(taskDate);
      } else if (taskDate === todayStr && isTaskOverdue(t)) {
        // Overdue today task not completed
        missedDates.add(taskDate);
      }
    }

    // 2. Task notes explicitly marked isAutoMissed
    const notes = Array.isArray(t?.daily_notes || t?.dailyNotes || t?.notes)
      ? (t.daily_notes || t.dailyNotes || t.notes)
      : [];
    notes.forEach(n => {
      if (!n || !n.date) return;
      if (n.isAutoMissed) {
        const d = getCleanDateStr(n.date);
        if (d && d <= targetStr) missedDates.add(d);
      }
    });

    // 3. Multi-day / carried tasks spanning past days without a submitted note
    const createdClean = getCleanDateStr(t.createdAt || t.created_at);
    const origClean = getCleanDateStr(t.originalDate || t.original_date);
    const dateClean = getCleanDateStr(t.date);
    const dueDateClean = getCleanDateStr(t.dueDateTime || t.due_date_time);

    const startDates = [createdClean, origClean, dateClean].filter(Boolean).sort();
    const cleanStartStr = startDates.length > 0 ? startDates[0] : null;

    const isCarried = Boolean(t.carriedOver || t.carried_over || t.wasCarried || t.isCarried || (origClean && dateClean && origClean < dateClean));
    const isMultiDay = Boolean((dueDateClean && cleanStartStr && dueDateClean > cleanStartStr) || isCarried || (notes.length > 0));

    if (isMultiDay && cleanStartStr) {
      const existingNoteDates = new Set(
        notes.map(n => (n && n.date ? getCleanDateStr(n.date) : '')).filter(Boolean)
      );

      let maxEndStr = todayStr;
      const completedClean = getCleanDateStr(t.completedAt || t.completed_at);
      if (dueDateClean && dueDateClean < maxEndStr) {
        maxEndStr = dueDateClean;
      }
      if (completedClean && (t.status === 'done' || t.completed === true) && completedClean < maxEndStr) {
        maxEndStr = completedClean;
      } else if (dateClean && (t.status === 'missed' || t.status === 'done') && dateClean < maxEndStr) {
        maxEndStr = dateClean;
      }

      try {
        const startDateObj = parseISO(cleanStartStr);
        const endDateObj = parseISO(maxEndStr);
        const todayDateObj = parseISO(todayStr);

        if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime()) && startDateObj <= endDateObj) {
          let curr = new Date(startDateObj);
          while (curr <= endDateObj && curr <= todayDateObj) {
            const currStr = format(curr, 'yyyy-MM-dd');
            if (currStr <= targetStr) {
              if (currStr < todayStr && !existingNoteDates.has(currStr)) {
                if (!isDateOnLeave(currStr)) {
                  // This past day had no note submitted and was not on leave -> shows [★ 0] Missed!
                  missedDates.add(currStr);
                }
              } else if (currStr === todayStr && isTaskOverdue(t) && !existingNoteDates.has(currStr)) {
                if (!isDateOnLeave(currStr)) {
                  missedDates.add(currStr);
                }
              }
            }
            curr = addDays(curr, 1);
          }
        }
      } catch (e) {
        // ignore date parse error
      }
    }
  };

  // Process archives
  (archives || []).forEach(arc => {
    if (!arc) return;
    const cleanD = getCleanDateStr(arc.date);
    if (Array.isArray(arc.tasks)) {
      arc.tasks.forEach(t => processTask(t, cleanD));
    }
  });

  // Process today's tasks
  (todayTasks || []).forEach(t => processTask(t, todayStr));

  return missedDates;
}

export function getAllValidStreakDates(archives = [], todayTasks = []) {
  const missedDates = getMissedDatesSet(archives, todayTasks);
  const activeDates = new Set();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const processTask = (t, defaultDate) => {
    if (!t) return;
    // 1. Task completed and rated (>= 0)
    const isRatedTask = (t.status === 'done' || t.completedAt || t.completed_at) &&
      t.rating != null && !isNaN(Number(t.rating)) && Number(t.rating) >= 0;
    if (isRatedTask) {
      const compDate = getCleanDateStr(t.completedAt || t.completed_at || t.date || defaultDate);
      if (compDate && !isDateOnLeave(compDate) && !missedDates.has(compDate)) activeDates.add(compDate);
    }

    // 2. Task note rated (not auto-missed)
    const notes = Array.isArray(t?.daily_notes || t?.dailyNotes || t?.notes)
      ? (t.daily_notes || t.dailyNotes || t.notes)
      : [];
    notes.forEach(n => {
      if (!n || !n.date) return;
      const r = parseFloat(n.rating != null ? n.rating : (n.score != null ? n.score : 0));
      if (!isNaN(r) && r >= 0 && !n.isAutoMissed && n.rating != null) {
        const noteDate = getCleanDateStr(n.date);
        if (noteDate && !isDateOnLeave(noteDate) && !missedDates.has(noteDate)) activeDates.add(noteDate);
      }
    });
  };

  // 1. Process archives
  (archives || []).forEach(arc => {
    if (!arc) return;
    const cleanD = getCleanDateStr(arc.date);
    if (Array.isArray(arc.tasks) && arc.tasks.length > 0) {
      arc.tasks.forEach(t => processTask(t, cleanD));
    }
  });

  // 2. Process today's tasks
  if (Array.isArray(todayTasks) && todayTasks.length > 0) {
    todayTasks.forEach(t => processTask(t, todayStr));
  }

  return Array.from(activeDates).filter(d => Boolean(d) && !missedDates.has(d) && !isDateOnLeave(d)).sort();
}

export function getStreakAsOfDate(archives = [], targetDateStr = null, todayTasks = []) {
  const effectiveTarget = targetDateStr
    ? (targetDateStr.includes('T') ? targetDateStr.split('T')[0] : targetDateStr.trim().substring(0, 10))
    : format(new Date(), 'yyyy-MM-dd');

  // If effectiveTarget is a leave date, streak breaks completely
  if (isDateOnLeave(effectiveTarget)) {
    return { current: 0, isActive: false };
  }

  const missedDatesSet = getMissedDatesSet(archives, todayTasks, effectiveTarget);

  // If effectiveTarget has any missed task or missed task note, streak breaks completely
  if (missedDatesSet.has(effectiveTarget)) {
    return { current: 0, isActive: false };
  }

  // Collect all active dates <= effectiveTarget (excluding any missed dates or leave dates)
  const activeDatesSet = new Set();

  const processTask = (t, defaultDate) => {
    if (!t) return;
    // 1. Task completed and rated
    const isRatedTask = (t.status === 'done' || t.completedAt || t.completed_at) &&
      t.rating != null && !isNaN(Number(t.rating)) && Number(t.rating) >= 0;
    if (isRatedTask) {
      const compDate = getCleanDateStr(t.completedAt || t.completed_at || t.date || defaultDate);
      if (compDate && compDate <= effectiveTarget && !isDateOnLeave(compDate) && !missedDatesSet.has(compDate)) {
        activeDatesSet.add(compDate);
      }
    }

    // 2. Task note rated
    const notes = Array.isArray(t?.daily_notes || t?.dailyNotes || t?.notes)
      ? (t.daily_notes || t.dailyNotes || t.notes)
      : [];
    notes.forEach(n => {
      if (!n || !n.date) return;
      const r = parseFloat(n.rating != null ? n.rating : (n.score != null ? n.score : 0));
      if (!isNaN(r) && r >= 0 && !n.isAutoMissed && n.rating != null) {
        const noteDate = getCleanDateStr(n.date);
        if (noteDate && noteDate <= effectiveTarget && !isDateOnLeave(noteDate) && !missedDatesSet.has(noteDate)) {
          activeDatesSet.add(noteDate);
        }
      }
    });
  };

  (archives || []).forEach(arc => {
    if (!arc || !arc.date) return;
    const cleanD = getCleanDateStr(arc.date);
    if (!cleanD || cleanD > effectiveTarget) return;

    if (Array.isArray(arc.tasks) && arc.tasks.length > 0) {
      arc.tasks.forEach(t => processTask(t, cleanD));
    }
  });

  if (Array.isArray(todayTasks) && todayTasks.length > 0) {
    todayTasks.forEach(t => processTask(t, effectiveTarget));
  }

  if (activeDatesSet.size === 0) {
    return { current: 0, isActive: false };
  }

  let checkDate = parseISO(effectiveTarget);
  if (isNaN(checkDate.getTime())) {
    checkDate = new Date();
  }

  const prevDate = subDays(checkDate, 1);

  // If effectiveTarget (e.g. today) has no rated tasks or rated notes, streak for target date is 0
  if (!activeDatesSet.has(effectiveTarget)) {
    return { current: 0, isActive: false };
  }

  let streakCount = 1;
  let isActive = true;
  let currCheckDate = prevDate;

  // Count backwards for consecutive active days prior to effectiveTarget.
  // Encountering a leave date OR a missed date breaks the streak completely.
  while (true) {
    const dStr = format(currCheckDate, 'yyyy-MM-dd');
    if (isDateOnLeave(dStr)) {
      break;
    }
    if (missedDatesSet.has(dStr)) {
      break;
    }
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
  return getStreakAsOfDate(archives, todayStr, todayTasks);
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

export function getMostMissedTimeOfDay(archives = [], todayTasks = []) {
  const hourCounts = {};
  const processedMissedKeys = new Set();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const recordMissedHour = (task, key) => {
    if (!task) return;
    if (key && processedMissedKeys.has(key)) return;
    if (key) processedMissedKeys.add(key);

    const dueStr = task.dueDateTime || task.due_date_time;
    if (dueStr) {
      try {
        const date = parseISO(dueStr);
        if (!isNaN(date.getTime())) {
          const hour = date.getHours();
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          return;
        }
      } catch (e) {}
    }

    const createdStr = task.createdAt || task.created_at;
    if (createdStr) {
      try {
        const date = parseISO(createdStr);
        if (!isNaN(date.getTime())) {
          const hour = date.getHours();
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }
      } catch (e) {}
    }
  };

  const processTask = (task) => {
    if (!task) return;
    const taskId = String(task.id || task._id || Math.random());

    // 1. Whole task marked missed
    if (task.status === 'missed' || task.missed === true || task.wasMissed === true || task.was_missed === true) {
      recordMissedHour(task, `whole_${taskId}`);
    }

    // 2. Missed daily task notes
    const notes = Array.isArray(task.daily_notes || task.dailyNotes || task.notes)
      ? (task.daily_notes || task.dailyNotes || task.notes)
      : [];

    notes.forEach(n => {
      if (!n) return;
      const nDate = getLocalDateStr(n.date);
      if (!nDate) return;
      if (n.isLeaveApplied || isDateOnLeave(nDate)) return;

      if (n.isAutoMissed || (n.rating === 0 && String(n.note || '').toLowerCase() === 'missed')) {
        recordMissedHour(task, `note_${taskId}_${nDate}`);
      }
    });

    // 3. Past days within multi-day task span without notes and not on leave
    const dates = [];
    const cClean = getLocalDateStr(task.createdAt || task.created_at);
    if (cClean) dates.push(cClean);
    const oClean = getLocalDateStr(task.originalDate || task.original_date);
    if (oClean) dates.push(oClean);
    const tClean = getLocalDateStr(task.date);
    if (tClean) dates.push(tClean);
    dates.sort();

    if (dates.length > 0) {
      const cleanStartStr = dates[0];
      const existingDates = new Set(notes.map(n => getLocalDateStr(n && n.date)).filter(Boolean));
      try {
        const startDate = parseISO(cleanStartStr);
        const todayDate = parseISO(todayStr);
        if (!isNaN(startDate.getTime()) && !isNaN(todayDate.getTime()) && startDate < todayDate) {
          let curr = new Date(startDate);
          while (curr < todayDate) {
            const currStr = format(curr, 'yyyy-MM-dd');
            if (!existingDates.has(currStr) && !isDateOnLeave(currStr)) {
              recordMissedHour(task, `unsubmitted_${taskId}_${currStr}`);
            }
            curr.setDate(curr.getDate() + 1);
          }
        }
      } catch (e) {}
    }
  };

  (archives || []).forEach(arc => {
    if (arc && Array.isArray(arc.tasks)) {
      arc.tasks.forEach(processTask);
    }
  });

  (todayTasks || []).forEach(processTask);

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

export function getTotalTasksDone(archives = [], todayTasks = []) {
  const completedTaskIds = new Set();
  const countedNoteKeys = new Set();
  let total = 0;

  const processTask = (t) => {
    if (!t) return;
    const taskId = String(t.id || t._id || Math.random());

    // 1. Whole completed task
    if (t.status === 'done' || t.completed === true) {
      if (!completedTaskIds.has(taskId)) {
        completedTaskIds.add(taskId);
        total++;
      }
    }

    // 2. Rated daily task notes from multi-day/carried tasks
    const notes = Array.isArray(t.daily_notes || t.dailyNotes || t.notes)
      ? (t.daily_notes || t.dailyNotes || t.notes)
      : [];

    notes.forEach(n => {
      if (!n) return;
      const nDate = getLocalDateStr(n.date);
      if (!nDate) return;

      if (n.isLeaveApplied || isDateOnLeave(nDate) || n.isAutoMissed) return;

      const r = parseFloat(n.rating != null ? n.rating : (n.score != null ? n.score : null));
      const isRated = !isNaN(r) && r !== null && (r > 0 || (r === 0 && !n.isAutoMissed && String(n.note || '').toLowerCase() !== 'missed'));

      if (isRated) {
        const noteKey = `${taskId}_${nDate}`;
        if (!countedNoteKeys.has(noteKey)) {
          countedNoteKeys.add(noteKey);
          total++;
        }
      }
    });
  };

  (archives || []).forEach(arc => {
    if (arc && Array.isArray(arc.tasks)) {
      arc.tasks.forEach(processTask);
    }
  });

  (todayTasks || []).forEach(processTask);

  return total;
}

export function buildHistoricalDailyArchives(archives = [], todayTasks = []) {
  const map = new Map();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const persistentScores = getDailyRingScores();

  // 1. Index all unique tasks
  const allTasksMap = new Map();
  (archives || []).forEach(arc => {
    if (arc && Array.isArray(arc.tasks)) {
      arc.tasks.forEach(t => {
        if (!t) return;
        const tid = String(t.id || t._id);
        if (tid && !allTasksMap.has(tid)) allTasksMap.set(tid, t);
      });
    }
  });
  (todayTasks || []).forEach(t => {
    if (!t) return;
    const tid = String(t.id || t._id);
    if (tid && !allTasksMap.has(tid)) allTasksMap.set(tid, t);
  });

  const allTasks = Array.from(allTasksMap.values());

  // 2. Base mapping from existing archives
  (archives || []).forEach(arc => {
    if (!arc || !arc.date) return;
    const cleanD = getLocalDateStr(arc.date);
    if (!cleanD) return;
    const taskList = Array.isArray(arc.tasks) ? arc.tasks : [];
    const hasDone = taskList.some(t => t && (t.status === 'done' || t.completedAt || t.completed_at)) || Boolean(arc.hasDone);
    
    // Priority: Persisted ring score for this date > arc.score > calculateDailyScore
    let dayScore = arc.score !== undefined && arc.score !== null ? Number(arc.score) : 0;
    if (persistentScores && persistentScores[cleanD] !== undefined && persistentScores[cleanD] > 0) {
      dayScore = persistentScores[cleanD];
    } else if (!dayScore && taskList.length > 0) {
      dayScore = calculateDailyScore(taskList, cleanD).score;
    }

    map.set(cleanD, {
      ...arc,
      date: cleanD,
      score: dayScore,
      tasks: [...taskList],
      hasTasks: taskList.length > 0 || Boolean(arc.hasTasks),
      hasDone,
      isLeave: isDateOnLeave(cleanD)
    });
  });

  // Seed map with any persisted daily ring scores
  if (persistentScores) {
    Object.keys(persistentScores).forEach(cleanD => {
      const pScore = persistentScores[cleanD];
      if (pScore !== undefined && pScore > 0) {
        if (!map.has(cleanD)) {
          map.set(cleanD, {
            date: cleanD,
            score: pScore,
            tasks: [],
            hasTasks: true,
            hasDone: true,
            isLeave: isDateOnLeave(cleanD)
          });
        } else {
          const existing = map.get(cleanD);
          existing.score = pScore;
        }
      }
    });
  }

  // 3. For multi-day and carried tasks, populate days they span across
  allTasks.forEach(task => {
    const notes = Array.isArray(task.daily_notes || task.dailyNotes || task.notes)
      ? (task.daily_notes || task.dailyNotes || task.notes)
      : [];

    const isMultiDay = notes.length > 0 || task.carriedOver || task.carried_over ||
      (task.originalDate && task.originalDate !== task.date) ||
      (task.original_date && task.original_date !== task.date);

    if (!isMultiDay && notes.length === 0) return;

    const dates = [];
    const cClean = getLocalDateStr(task.createdAt || task.created_at);
    if (cClean) dates.push(cClean);
    const oClean = getLocalDateStr(task.originalDate || task.original_date);
    if (oClean) dates.push(oClean);
    const tClean = getLocalDateStr(task.date);
    if (tClean) dates.push(tClean);
    notes.forEach(n => {
      const nD = getLocalDateStr(n && n.date);
      if (nD) dates.push(nD);
    });
    dates.sort();

    const startStr = dates.length > 0 ? dates[0] : todayStr;
    const endStr = dates.length > 0 ? dates[dates.length - 1] : todayStr;
    const maxEndStr = endStr > todayStr ? todayStr : endStr;

    try {
      const sObj = parseISO(startStr);
      const eObj = parseISO(maxEndStr);
      if (!isNaN(sObj.getTime()) && !isNaN(eObj.getTime()) && sObj <= eObj) {
        let curr = new Date(sObj);
        while (curr <= eObj) {
          const dStr = format(curr, 'yyyy-MM-dd');
          if (!map.has(dStr)) {
            map.set(dStr, {
              date: dStr,
              score: 0,
              tasks: [],
              hasTasks: false,
              hasDone: false,
              isLeave: isDateOnLeave(dStr)
            });
          }
          const dayRec = map.get(dStr);
          const alreadyHasTask = dayRec.tasks.some(t => String(t.id || t._id) === String(task.id || task._id));
          if (!alreadyHasTask) {
            dayRec.tasks.push(task);
            dayRec.hasTasks = true;
          }
          curr.setDate(curr.getDate() + 1);
        }
      }
    } catch (e) {}
  });

  // 4. Ensure today has todayTasks and accurate live ring score
  if (!map.has(todayStr) || (todayTasks && todayTasks.length > 0)) {
    const existing = map.get(todayStr) || { date: todayStr, tasks: [], hasTasks: false, hasDone: false };
    const mergedTodayTasks = [...(todayTasks || [])];
    existing.tasks.forEach(t => {
      if (!mergedTodayTasks.some(mt => String(mt.id || mt._id) === String(t.id || t._id))) {
        mergedTodayTasks.push(t);
      }
    });
    const res = calculateDailyScore(mergedTodayTasks, todayStr);
    const hasDone = mergedTodayTasks.some(t => t && (t.status === 'done' || t.completedAt || t.completed_at));

    const todayScore = (persistentScores && persistentScores[todayStr] !== undefined && persistentScores[todayStr] > 0)
      ? Math.max(res.score, persistentScores[todayStr])
      : res.score;

    if (todayScore > 0) {
      saveDailyRingScore(todayStr, todayScore);
    }

    map.set(todayStr, {
      ...existing,
      date: todayStr,
      score: todayScore,
      tasks: mergedTodayTasks,
      hasTasks: mergedTodayTasks.length > 0,
      hasDone: hasDone || Boolean(existing.hasDone),
      isLeave: isDateOnLeave(todayStr)
    });
  }

  // 5. Final pass for all days:
  // - If leave: score = null, isLeave = true
  // - If persisted ring score exists: KEEP EXACT PERSISTED RING SCORE!
  // - For past days without persisted score: use calculateDailyScore(dayRec.tasks, dStr).score
  // - Never artificially zero out unsubmitted notes on past days!
  map.forEach((dayRec, dStr) => {
    if (isDateOnLeave(dStr)) {
      dayRec.isLeave = true;
      dayRec.score = null;
      return;
    }
    if (dStr === todayStr) {
      return;
    }

    if (persistentScores && persistentScores[dStr] !== undefined && persistentScores[dStr] > 0) {
      dayRec.score = persistentScores[dStr];
      return;
    }

    if (dayRec.hasTasks && dayRec.tasks.length > 0) {
      const dayScoreRes = calculateDailyScore(dayRec.tasks, dStr);
      dayRec.score = dayScoreRes.score;
      dayRec.hasDone = dayScoreRes.breakdown.doneCount > 0 || Boolean(dayRec.hasDone);
      if (dayScoreRes.score > 0) {
        saveDailyRingScore(dStr, dayScoreRes.score);
      }
    }
  });

  return Array.from(map.values()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

