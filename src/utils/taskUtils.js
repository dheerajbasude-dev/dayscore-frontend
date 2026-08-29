import { format, parseISO } from 'date-fns';

/**
 * Safely parse a date string or Date object into 'yyyy-MM-dd' formatted string.
 */
export const getLocalDateStr = (val) => {
  if (!val) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    try {
      const parsed = parseISO(trimmed);
      if (!isNaN(parsed.getTime())) {
        return format(parsed, 'yyyy-MM-dd');
      }
    } catch (e) {}
    if (trimmed.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.substring(0, 10);
    }
  } else if (val instanceof Date && !isNaN(val.getTime())) {
    return format(val, 'yyyy-MM-dd');
  }
  return '';
};

/**
 * Calculates automated rating metrics for a multi-day or single task based on its daily notes.
 * Automatically backfills missed past days with 0 ratings.
 */
export const calculateTaskAutoRating = (taskOrNotes, todayStrParam) => {
  let taskObj = null;
  let notes = [];
  
  if (Array.isArray(taskOrNotes)) {
    notes = taskOrNotes;
  } else if (taskOrNotes && typeof taskOrNotes === 'object') {
    taskObj = taskOrNotes;
    notes = Array.isArray(taskObj.daily_notes || taskObj.dailyNotes || taskObj.notes)
      ? (taskObj.daily_notes || taskObj.dailyNotes || taskObj.notes)
      : [];
  }

  const todayStr = todayStrParam || format(new Date(), 'yyyy-MM-dd');
  let effectiveNotes = [...notes];

  if (taskObj) {
    const dates = [];
    const createdClean = getLocalDateStr(taskObj.createdAt || taskObj.created_at);
    if (createdClean) dates.push(createdClean);

    const origClean = getLocalDateStr(taskObj.originalDate || taskObj.original_date);
    if (origClean) dates.push(origClean);

    const taskDateClean = getLocalDateStr(taskObj.date);
    if (taskDateClean) dates.push(taskDateClean);

    dates.sort();
    const cleanStartStr = dates.length > 0 ? dates[0] : todayStr;
    const existingDates = new Set(notes.map(n => n && n.date ? getLocalDateStr(n.date) : '').filter(Boolean));

    let endStr = todayStr;
    const dueDateClean = getLocalDateStr(taskObj.dueDateTime || taskObj.due_date_time);
    if (dueDateClean) {
      if (dueDateClean < endStr) endStr = dueDateClean;
    } else {
      const completedDateClean = getLocalDateStr(taskObj.completedAt || taskObj.completed_at);
      if (completedDateClean && completedDateClean > endStr) endStr = completedDateClean;
    }

    try {
      const startDate = parseISO(cleanStartStr);
      const endDate = parseISO(endStr);

      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate <= endDate) {
        let curr = new Date(startDate);
        while (curr <= endDate) {
          const currStr = format(curr, 'yyyy-MM-dd');
          if (!existingDates.has(currStr)) {
            effectiveNotes.push({
              id: `missed-${currStr}`,
              date: currStr,
              note: 'Missed',
              rating: 0,
              isAutoMissed: true
            });
          }
          curr.setDate(curr.getDate() + 1);
        }
      }
    } catch (e) {
      console.error('Error filling missed days in rating calc:', e);
    }
  }

  if (effectiveNotes.length === 0) return { hasRatedNote: false, avgRating: 0, sumRating: 0, totalCount: 0 };

  let sumRating = 0;
  let hasRatedNote = false;

  effectiveNotes.forEach(n => {
    if (!n) return;
    const r = parseFloat(n.rating != null ? n.rating : (n.score != null ? n.score : 0));
    if (!isNaN(r) && r > 0 && !n.isAutoMissed) {
      sumRating += r;
      hasRatedNote = true;
    }
  });

  if (!hasRatedNote) return { hasRatedNote: false, avgRating: 0, sumRating: 0, totalCount: effectiveNotes.length };

  const totalCount = effectiveNotes.length;
  const avgRating = Math.round((sumRating / totalCount) * 10) / 10;

  return { hasRatedNote: true, avgRating, sumRating, totalCount };
};
