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

/**
 * Smart compact date/time range helper for tasks:
 * Eliminates redundant date repeats when created, due, and completion dates share the same day.
 * Instead of: Sep 07, 10:36 PM → Sep 07, 11:59 PM · ✓ Sep 07, 10:36 PM (wrapped to 2 lines)
 * Yields:     Sep 07, 10:36 PM → 11:59 PM · ✓ 10:36 PM (fits cleanly on 1 line)
 */
export const formatTaskMetaDates = (task) => {
  if (!task) {
    return {
      createdFormatted: null,
      dueFormatted: null,
      completedFormatted: null,
      datesRange: null,
      completedText: null
    };
  }

  const parseDateSafe = (iso) => {
    if (!iso) return null;
    try {
      const d = typeof iso === 'string' ? parseISO(iso) : new Date(iso);
      return isNaN(d.getTime()) ? null : d;
    } catch (e) {
      return null;
    }
  };

  const createdIso = task.createdAt || task.created_at || task.originalDate || task.original_date;
  const dueIso = task.dueDateTime || task.due_date_time;
  const completedIso = task.completedAt || task.completed_at;

  const createdDate = parseDateSafe(createdIso);
  const dueDate = parseDateSafe(dueIso);
  const completedDate = parseDateSafe(completedIso);

  const createdDay = createdDate 
    ? format(createdDate, 'yyyy-MM-dd') 
    : (task.date ? getLocalDateStr(task.date) : null);
  const dueDay = dueDate ? format(dueDate, 'yyyy-MM-dd') : null;

  let createdFormatted = null;
  let dueFormatted = null;
  let datesRange = null;

  if (createdDate && dueDate) {
    const sameDay = Boolean(createdDay && dueDay && createdDay === dueDay);
    createdFormatted = format(createdDate, 'MMM dd, h:mm a');
    if (sameDay) {
      dueFormatted = format(dueDate, 'h:mm a');
      datesRange = `${createdFormatted} → ${dueFormatted}`;
    } else {
      dueFormatted = format(dueDate, 'MMM dd, h:mm a');
      datesRange = `${createdFormatted} → ${dueFormatted}`;
    }
  } else if (dueDate) {
    const sameAsTaskDay = Boolean(createdDay && dueDay && createdDay === dueDay);
    if (sameAsTaskDay) {
      dueFormatted = format(dueDate, 'h:mm a');
    } else {
      dueFormatted = format(dueDate, 'MMM dd, h:mm a');
    }
    datesRange = `Due ${dueFormatted}`;
  } else if (createdDate) {
    createdFormatted = format(createdDate, 'MMM dd, h:mm a');
    datesRange = createdFormatted;
  }

  let completedFormatted = null;
  let completedText = null;

  if (completedDate) {
    const baseDay = dueDay || createdDay || null;
    const isSameDayAsBase = Boolean(baseDay && format(completedDate, 'yyyy-MM-dd') === baseDay);
    if (isSameDayAsBase) {
      completedFormatted = format(completedDate, 'h:mm a');
      completedText = `✓ ${completedFormatted}`;
    } else {
      completedFormatted = format(completedDate, 'MMM dd, h:mm a');
      completedText = `✓ ${completedFormatted}`;
    }
  }

  return {
    createdFormatted,
    dueFormatted,
    completedFormatted,
    datesRange,
    completedText
  };
};
