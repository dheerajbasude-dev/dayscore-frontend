import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { format, subDays, addDays, parseISO } from 'date-fns'
import ScoreRing from '../components/ScoreRing'
import TaskCard from '../components/TaskCard'
import AddTaskModal from '../components/AddTaskModal'
import RatingSliderModal from '../components/RatingSliderModal'
import CustomDatePicker from '../components/CustomDatePicker'
import CustomSelect from '../components/CustomSelect'
import ReflectionBox from '../components/ReflectionBox'
import ConfettiCelebration from '../components/ConfettiCelebration'
import PenaltyCelebration from '../components/PenaltyCelebration'
import AuthModal from '../components/AuthModal'
import { Plus, AlertTriangle, Gift, PenLine, ChevronLeft, ChevronRight, ChevronUp, Calendar, Layers, Search, SlidersHorizontal, Filter, RotateCcw, X, Clock, Zap, Check } from 'lucide-react'
import * as store from '../store/store'
import * as scoring from '../store/scoring'
import { useDayRollover } from '../hooks/useDayRollover'
import { useNotifications } from '../hooks/useNotifications'
import { useAuth } from '../context/AuthContext'

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
    const createdIso = taskObj.createdAt || taskObj.created_at;
    if (createdIso) {
      const d = String(createdIso).split('T')[0];
      if (d && d.length >= 10) dates.push(d.substring(0, 10));
    }
    const orig = taskObj.originalDate || taskObj.original_date;
    if (orig) {
      const d = String(orig).split('T')[0];
      if (d && d.length >= 10) dates.push(d.substring(0, 10));
    }
    if (taskObj.date) {
      const d = String(taskObj.date).split('T')[0];
      if (d && d.length >= 10) dates.push(d.substring(0, 10));
    }
    dates.sort();
    const cleanStartStr = dates.length > 0 ? dates[0] : todayStr;
    const existingDates = new Set(notes.map(n => n && n.date ? String(n.date).split('T')[0] : ''));

      let endStr = todayStr;
      const dueIso = taskObj.dueDateTime || taskObj.due_date_time;
      if (dueIso) {
        try {
          const dueObj = typeof dueIso === 'string' ? parseISO(dueIso) : new Date(dueIso);
          const dueStr = format(dueObj, 'yyyy-MM-dd');
          if (dueStr < endStr) endStr = dueStr;
        } catch (e) {}
      } else if (taskObj.date && (taskObj.status === 'missed' || taskObj.status === 'done')) {
        const taskDateClean = String(taskObj.date).split('T')[0];
        if (taskDateClean < endStr) endStr = taskDateClean;
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

export default function TodayView() {
  const { user } = useAuth()
  const realTodayStr = format(new Date(), 'yyyy-MM-dd')
  const [todayStr, setTodayStr] = useState(realTodayStr)

  useEffect(() => {
    const timer = setInterval(() => {
      const nowToday = format(new Date(), 'yyyy-MM-dd')
      if (nowToday !== todayStr) {
        setTodayStr(nowToday)
      }
    }, 10000)
    return () => clearInterval(timer)
  }, [todayStr])

  const [currentDateStr, setCurrentDateStr] = useState(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    try {
      const uid = store.getUserId()
      const lastSessionDate = localStorage.getItem(`dayscore_${uid}_last_session_date`)
      const savedSelectedDate = localStorage.getItem(`dayscore_${uid}_selected_date`)

      // If visiting on a NEW day (last session was a previous day), default to today's date
      if (!lastSessionDate || lastSessionDate < today) {
        localStorage.setItem(`dayscore_${uid}_last_session_date`, today)
        localStorage.setItem(`dayscore_${uid}_selected_date`, today)
        return today
      }

      // Same-day refresh: Keep whatever date the user selected during their session
      if (savedSelectedDate && /^\d{4}-\d{2}-\d{2}$/.test(savedSelectedDate)) {
        return savedSelectedDate
      }
    } catch (e) {}
    return today
  })

  useEffect(() => {
    try {
      const uid = store.getUserId()
      const today = format(new Date(), 'yyyy-MM-dd')
      localStorage.setItem(`dayscore_${uid}_last_session_date`, today)
      if (currentDateStr) {
        localStorage.setItem(`dayscore_${uid}_selected_date`, currentDateStr)
      }
    } catch (e) {}
  }, [currentDateStr, user])

  const [viewMode, setViewMode] = useState(() => {
    try {
      const uid = store.getUserId()
      const saved = localStorage.getItem(`dayscore_${uid}_view_mode`)
      return (saved === 'all' || saved === 'date') ? saved : 'date'
    } catch {
      return 'date'
    }
  })

  const handleSetViewMode = (mode) => {
    setViewMode(mode)
    try {
      const uid = store.getUserId()
      localStorage.setItem(`dayscore_${uid}_view_mode`, mode)
    } catch (e) { }
  }

  const [tasks, setTasks] = useState([])
  const [reflection, setReflection] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showReflectionModal, setShowReflectionModal] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [deletingTaskIds, setDeletingTaskIds] = useState(new Set())

  // Persistent Filter, Sort & Search States (persists across F5 reloads)
  const [searchQuery, setSearchQuery] = useState(() => {
    try { return sessionStorage.getItem('dayscore_filter_search') || ''; } catch { return ''; }
  });
  const [sortOption, setSortOption] = useState(() => {
    try { return sessionStorage.getItem('dayscore_filter_sort') || 'default'; } catch { return 'default'; }
  });
  const [filterCategory, setFilterCategory] = useState(() => {
    try { return sessionStorage.getItem('dayscore_filter_category') || 'all'; } catch { return 'all'; }
  });
  const [filterPriority, setFilterPriority] = useState(() => {
    try { return sessionStorage.getItem('dayscore_filter_priority') || 'all'; } catch { return 'all'; }
  });
  const [filterStatus, setFilterStatus] = useState(() => {
    try { return sessionStorage.getItem('dayscore_filter_status') || 'all'; } catch { return 'all'; }
  });
  const [filterRatingRange, setFilterRatingRange] = useState(() => {
    try { return sessionStorage.getItem('dayscore_filter_rating') || 'all'; } catch { return 'all'; }
  });
  const [filterDateFrom, setFilterDateFrom] = useState(() => {
    try { return sessionStorage.getItem('dayscore_filter_date_from') || ''; } catch { return ''; }
  });
  const [filterDateTo, setFilterDateTo] = useState(() => {
    try { return sessionStorage.getItem('dayscore_filter_date_to') || ''; } catch { return ''; }
  });
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Sync active filter/sort selections to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('dayscore_filter_search', searchQuery);
      sessionStorage.setItem('dayscore_filter_sort', sortOption);
      sessionStorage.setItem('dayscore_filter_category', filterCategory);
      sessionStorage.setItem('dayscore_filter_priority', filterPriority);
      sessionStorage.setItem('dayscore_filter_status', filterStatus);
      sessionStorage.setItem('dayscore_filter_rating', filterRatingRange);
      sessionStorage.setItem('dayscore_filter_date_from', filterDateFrom);
      sessionStorage.setItem('dayscore_filter_date_to', filterDateTo);
    } catch (e) {}
  }, [searchQuery, sortOption, filterCategory, filterPriority, filterStatus, filterRatingRange, filterDateFrom, filterDateTo]);

  const resetAllFilters = () => {
    setSearchQuery('');
    setSortOption('default');
    setFilterCategory('all');
    setFilterPriority('all');
    setFilterStatus('all');
    setFilterRatingRange('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    try {
      sessionStorage.removeItem('dayscore_filter_search');
      sessionStorage.removeItem('dayscore_filter_sort');
      sessionStorage.removeItem('dayscore_filter_category');
      sessionStorage.removeItem('dayscore_filter_priority');
      sessionStorage.removeItem('dayscore_filter_status');
      sessionStorage.removeItem('dayscore_filter_rating');
      sessionStorage.removeItem('dayscore_filter_date_from');
      sessionStorage.removeItem('dayscore_filter_date_to');
    } catch (e) {}
  };

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (searchQuery.trim()) count++
    if (sortOption !== 'default') count++
    if (filterCategory !== 'all') count++
    if (filterPriority !== 'all') count++
    if (filterStatus !== 'all') count++
    if (filterRatingRange !== 'all') count++
    if (filterDateFrom) count++
    if (filterDateTo) count++
    return count
  }, [searchQuery, sortOption, filterCategory, filterPriority, filterStatus, filterRatingRange, filterDateFrom, filterDateTo])

  const isToday = currentDateStr === todayStr

  const handleOpenAddModal = () => {
    if (currentDateStr < todayStr) return
    setShowAddModal(true)
  }

  useEffect(() => {
    const handleOpenModalEvent = () => {
      if (currentDateStr < todayStr) return
      setShowAddModal(true)
    }
    window.addEventListener('open-add-task-modal', handleOpenModalEvent)
    return () => window.removeEventListener('open-add-task-modal', handleOpenModalEvent)
  }, [currentDateStr, todayStr])

  const [showPenaltyFlash, setShowPenaltyFlash] = useState(false)
  const [ratingTask, setRatingTask] = useState(null)

  // Lock body scroll when any modal is open
  useEffect(() => {
    const anyModalOpen = showAddModal || showAuthModal || showReflectionModal || showFilterModal || !!ratingTask
    if (anyModalOpen) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
    return () => document.body.classList.remove('modal-open')
  }, [showAddModal, showAuthModal, showReflectionModal, showFilterModal, ratingTask])

  // --- Dual-Container Scroll Management (Window & .main-content) ---
  const [showScrollTopBtn, setShowScrollTopBtn] = useState(false);
  const hasRestoredScrollRef = useRef(false);

  // Disable browser auto scroll restoration to avoid scroll jumps on refresh
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  const getScrollTop = () => {
    const mainEl = document.querySelector('.main-content');
    const mainScroll = mainEl ? mainEl.scrollTop : 0;
    const winScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    return Math.max(mainScroll, winScroll);
  };

  const setScrollTop = (targetY, behavior = 'instant') => {
    const mainEl = document.querySelector('.main-content');
    if (mainEl && mainEl.scrollHeight > mainEl.clientHeight) {
      mainEl.scrollTo({ top: targetY, behavior });
    }
    window.scrollTo({ top: targetY, behavior });
  };

  const scrollToTop = () => {
    setScrollTop(0, 'smooth');
  };

  // Track scroll position for persistence and "Scroll to Top" button
  useEffect(() => {
    const handleScrollTracking = () => {
      const currentY = getScrollTop();
      if (currentY > 0) {
        sessionStorage.setItem('dayscore_today_scroll_pos', currentY.toString());
      }
      setShowScrollTopBtn(currentY > 350);
    };

    const mainEl = document.querySelector('.main-content');

    window.addEventListener('beforeunload', handleScrollTracking);
    window.addEventListener('pagehide', handleScrollTracking);
    window.addEventListener('scroll', handleScrollTracking, { passive: true });

    if (mainEl) {
      mainEl.addEventListener('scroll', handleScrollTracking, { passive: true });
    }

    return () => {
      window.removeEventListener('beforeunload', handleScrollTracking);
      window.removeEventListener('pagehide', handleScrollTracking);
      window.removeEventListener('scroll', handleScrollTracking);
      if (mainEl) {
        mainEl.removeEventListener('scroll', handleScrollTracking);
      }
    };
  }, []);

  const [archives, setArchives] = useState([])
  const [scoreResult, setScoreResult] = useState({ score: 0, baseScore: 0, bonus1: 0, bonus2: 0, penalty: 0 })
  const [streak, setStreak] = useState({ current: 0, isActive: false })
  const [averages, setAverages] = useState({ week: 0, month: 0, allTime: 0 })

  const [activePunishment, setActivePunishment] = useState(null)
  const [pastUnfinishedDates, setPastUnfinishedDates] = useState([])
  const [showPastPendingBanner, setShowPastPendingBanner] = useState(false)

  const [todaysReward, setTodaysReward] = useState(null)
  const [settings, setSettings] = useState({ notifications: false })
  const [loading, setLoading] = useState(true)
  const [dateWarningToast, setDateWarningToast] = useState(null)
  const [autoCarriedToastInfo, setAutoCarriedToastInfo] = useState(null)

  const isCarriedTask = useCallback((t) => {
    if (!t) return false;
    if (Boolean(t.carriedOver || t.carried_over || t.wasCarried || t.isCarried)) {
      return true;
    }
    const taskDate = t.date ? (typeof t.date === 'string' ? t.date.trim().substring(0, 10) : '') : currentDateStr;
    const orig = t.originalDate || t.original_date;
    const origDate = orig ? (typeof orig === 'string' ? orig.trim().substring(0, 10) : '') : '';
    const createdDate = t.createdAt ? (typeof t.createdAt === 'string' ? t.createdAt.substring(0, 10) : '') : 
                       (t.created_at ? (typeof t.created_at === 'string' ? t.created_at.substring(0, 10) : '') : '');

    if (origDate && taskDate && origDate < taskDate) return true;
    if (createdDate && taskDate && createdDate < taskDate) return true;
    return false;
  }, [currentDateStr]);

  // --- Automated Background Carry-Over Toast Notification State ---
  const initialCarriedCount = useMemo(() => {
    const uid = store.getUserId();
    const prefix = `dayscore_${uid}_tasks_`;
    const todayTasks = store.getTasks(todayStr);

    let carriedSet = new Set();
    // 1. Check current today tasks
    todayTasks.forEach(t => {
      if (!t) return;
      const isCarried = Boolean(t.carriedOver || t.carried_over || t.wasCarried || t.isCarried);
      const orig = t.originalDate || t.original_date;
      const origDate = orig ? (typeof orig === 'string' ? orig.trim().substring(0, 10) : '') : '';
      const createdDate = t.createdAt ? (typeof t.createdAt === 'string' ? t.createdAt.substring(0, 10) : '') : 
                         (t.created_at ? (typeof t.created_at === 'string' ? t.created_at.substring(0, 10) : '') : '');
      const effectiveOrig = origDate || createdDate;
      if (effectiveOrig && effectiveOrig < todayStr && t.status !== 'done') {
        carriedSet.add(String(t.id || t._id));
      } else if (isCarried && (!effectiveOrig || effectiveOrig < todayStr) && t.status !== 'done') {
        carriedSet.add(String(t.id || t._id));
      }
    });

    // 2. Pre-scan all past keys in localStorage for guest/user
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('_tasks_') && !key.endsWith(`_tasks_${todayStr}`)) {
        const parts = key.split('_tasks_');
        const pastDate = parts[1] ? parts[1].trim().substring(0, 10) : '';
        if (pastDate && pastDate < todayStr) {
          try {
            const pastList = JSON.parse(localStorage.getItem(key)) || [];
            pastList.forEach(t => {
              if (t.status !== 'done') {
                const dueIso = t.dueDateTime || t.due_date_time;
                let shouldCarry = true;
                if (dueIso) {
                  try {
                    const dueObj = typeof dueIso === 'string' ? parseISO(dueIso) : new Date(dueIso);
                    const dueDateStr = format(dueObj, 'yyyy-MM-dd');
                    if (dueDateStr < todayStr) shouldCarry = false;
                  } catch (e) {}
                }
                if (shouldCarry) {
                  carriedSet.add(String(t.id || t._id));
                }
              }
            });
          } catch (e) {}
        }
      }
    }
    return carriedSet.size;
  }, [todayStr]);

  const shouldShowInitialToast = useMemo(() => {
    if (initialCarriedCount <= 0) return false;
    try {
      const isAlreadyShown = localStorage.getItem(`dayscore_shown_carried_${todayStr}`);
      return !isAlreadyShown;
    } catch (e) {
      return false;
    }
  }, [initialCarriedCount, todayStr]);

  const [autoCarriedCount, setAutoCarriedCount] = useState(() => initialCarriedCount);
  const [showAutoCarriedBanner, setShowAutoCarriedBanner] = useState(() => shouldShowInitialToast);
  const autoCarryOverDoneRef = useRef(false);

  // Mark localStorage when toast is actually shown
  useEffect(() => {
    if (showAutoCarriedBanner) {
      try {
        localStorage.setItem(`dayscore_shown_carried_${todayStr}`, 'true');
      } catch (e) {}
    }
  }, [showAutoCarriedBanner, todayStr]);

  // Synchronously update carried task toast for both Date View and All Tasks mode instantly
  useEffect(() => {
    const todayTasks = store.getTasks(todayStr);
    const count = todayTasks.filter(t => isCarriedTask(t)).length || initialCarriedCount;
    if (count > 0) {
      setAutoCarriedCount(count);
      const isAlreadyShown = localStorage.getItem(`dayscore_shown_carried_${todayStr}`);
      if (!isAlreadyShown) {
        setShowAutoCarriedBanner(true);
      }
    }
  }, [tasks, todayStr, isCarriedTask, initialCarriedCount]);

  useEffect(() => {
    const runAutoCarryOver = async () => {
      if (autoCarryOverDoneRef.current) return;
      autoCarryOverDoneRef.current = true;

      // 1. Clean up tasks currently attached to todayStr
      const currentTodayTasks = store.getTasks(todayStr);
      let cleanedUpCount = 0;
      for (const t of currentTodayTasks) {
        const dueIso = t.dueDateTime || t.due_date_time;
        const orig = t.originalDate || t.original_date;
        const origDate = orig ? (typeof orig === 'string' ? orig.trim().substring(0, 10) : '') : '';
        let dueDateStr = '';
        if (dueIso) {
          try {
            const dueObj = typeof dueIso === 'string' ? parseISO(dueIso) : new Date(dueIso);
            dueDateStr = format(dueObj, 'yyyy-MM-dd');
          } catch (e) {}
        }

        // A task only expired on a past date if its due date itself expired before today (dueDateStr < todayStr).
        // If it has a due date on or after today (dueDateStr >= todayStr), it is active and extends into today/future!
        let pastEndDate = '';
        if (dueDateStr) {
          if (dueDateStr < todayStr) {
            pastEndDate = dueDateStr;
          }
        } else if (origDate && origDate < todayStr) {
          pastEndDate = origDate;
        }

        if (pastEndDate) {
          const { hasRatedNote, avgRating } = calculateTaskAutoRating(t);
          const finalStatus = (t.status === 'done' || hasRatedNote) ? 'done' : 'missed';
          
          const updates = {
            date: pastEndDate,
            carriedOver: false,
            carried_over: 0,
            status: finalStatus
          };
          if (finalStatus === 'done') {
            updates.completed = true;
            if (hasRatedNote) {
              updates.rating = avgRating;
            }
          }
          await store.updateTask(todayStr, t.id || t._id, updates);
          cleanedUpCount++;
        }
        // B: If a task originating from a PAST date carried over to today AND its due date is today or future, ensure status is 'pending'
        else if (t.status === 'missed' && origDate && origDate < todayStr && (!dueDateStr || dueDateStr >= todayStr)) {
          await store.updateTask(todayStr, t.id || t._id, {
            status: 'pending',
            carriedOver: true,
            carried_over: 1
          });
          cleanedUpCount++;
        }
      }

      // 2. Scan past tasks from previous dates:
      // Carry over tasks that are unfinished (pending/inprogress/missed) ONLY IF:
      // - task has NO due date, OR
      // - task's due date extends into Today or future (dueDateStr >= todayStr)
      const allArcs = archives.length > 0 ? archives : store.getArchivesFromTasks();
      const pastTasksToCarry = [];
      allArcs.forEach(arc => {
        if (arc.date && arc.date < todayStr && Array.isArray(arc.tasks)) {
          arc.tasks.forEach(t => {
            if (t.status !== 'done') {
              const dueIso = t.dueDateTime || t.due_date_time;
              let shouldCarryOver = true;
              if (dueIso) {
                try {
                  const dueObj = typeof dueIso === 'string' ? parseISO(dueIso) : new Date(dueIso);
                  const dueDateStr = format(dueObj, 'yyyy-MM-dd');
                  if (dueDateStr < todayStr) {
                    shouldCarryOver = false;
                  }
                } catch (e) {}
              }
              if (shouldCarryOver) {
                pastTasksToCarry.push({ ...t, taskDate: arc.date });
              }
            }
          });
        }
      });

      let carriedCount = 0;
      for (const task of pastTasksToCarry) {
        const originDate = task.taskDate || task.date || task.dateLabel;
        const taskId = task.id || task._id;
        if (!originDate || !taskId) continue;

        await store.updateTask(originDate, taskId, {
          date: todayStr,
          status: task.status === 'done' ? 'done' : 'pending',
          carriedOver: true,
          carried_over: 1,
          originalDate: originDate,
          original_date: originDate
        });
        carriedCount++;
      }

      if (carriedCount > 0 || cleanedUpCount > 0) {
        await store.fetchAllTasksApi();
        setCurrentDateStr(todayStr);
        setTasks(store.getTasks(todayStr));
        setArchives(store.getArchivesFromTasks());

        if (carriedCount > 0) {
          setAutoCarriedCount(carriedCount);
          const isAlreadyShown = localStorage.getItem(`dayscore_shown_carried_${todayStr}`);
          if (!isAlreadyShown) {
            setShowAutoCarriedBanner(true);
            try {
              localStorage.setItem(`dayscore_shown_carried_${todayStr}`, 'true');
            } catch (e) {}
          }
        }
      }
    };

    runAutoCarryOver();
  }, [todayStr, archives]);

  // Compute all dates that contain recorded task data or archives (plus today)
  const validTaskDates = useMemo(() => {
    const dateSet = new Set([todayStr]);
    const allArcs = archives.length > 0 ? archives : store.getAllArchives();

    (allArcs || []).forEach(arc => {
      if (arc && arc.date) {
        const cleanD = arc.date.includes('T') ? arc.date.split('T')[0] : arc.date.trim().substring(0, 10);
        const hasData = (Array.isArray(arc.tasks) && arc.tasks.length > 0) || arc.hasDone || (arc.score && Number(arc.score) > 0);
        if (hasData) {
          dateSet.add(cleanD);
        }
      }
    });

    (tasks || []).forEach(t => {
      const tDate = t.completedAt ? t.completedAt.substring(0, 10) : (t.date || todayStr);
      if (tDate) {
        const cleanD = tDate.includes('T') ? tDate.split('T')[0] : tDate.substring(0, 10);
        dateSet.add(cleanD);
      }
    });

    return Array.from(dateSet).sort();
  }, [archives, tasks, todayStr]);

  const minAvailableDate = validTaskDates.length > 0 ? validTaskDates[0] : todayStr;
  const canGoPrev = currentDateStr > minAvailableDate && validTaskDates.some(d => d < currentDateStr);
  const canGoNext = currentDateStr < todayStr && validTaskDates.some(d => d > currentDateStr);

  const handlePrevDay = () => {
    const prevDates = validTaskDates.filter(d => d < currentDateStr);
    if (prevDates.length > 0) {
      const targetPrev = prevDates[prevDates.length - 1];
      setCurrentDateStr(targetPrev);
    }
  }

  const handleNextDay = () => {
    const nextDate = validTaskDates.find(d => d > currentDateStr);
    if (nextDate && nextDate <= todayStr) {
      setCurrentDateStr(nextDate);
    }
  }

  const handleToday = () => {
    setCurrentDateStr(todayStr)
  }

  // Compute all tasks across all dates from active tasks & archives
  const allTasksAcrossDates = useMemo(() => {
    const list = [];
    const seenIds = new Set();

    const activeTasks = Array.isArray(tasks) ? tasks : [];
    activeTasks.forEach(t => {
      const id = t.id || t._id;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        list.push({ ...t, dateLabel: t.date || currentDateStr });
      } else if (!id) {
        list.push({ ...t, dateLabel: t.date || currentDateStr });
      }
    });

    const allArcs = archives.length > 0 ? archives : store.getAllArchives();
    allArcs.forEach(arc => {
      if (Array.isArray(arc.tasks)) {
        arc.tasks.forEach(t => {
          const id = t.id || t._id;
          if (id && !seenIds.has(id)) {
            seenIds.add(id);
            list.push({ ...t, dateLabel: arc.date });
          } else if (!id) {
            list.push({ ...t, dateLabel: arc.date });
          }
        });
      }
    });
    return list;
  }, [archives, tasks, currentDateStr]);

  // Initialize data per user & date
  useEffect(() => {
    let isMounted = true;
    const loadUserData = async () => {
      const allArchives = store.getArchivesFromTasks()
      if (!isMounted) return;
      setArchives(allArchives)

      const active = store.getActivePunishment()
      if (active && active.text && active.text.includes('(0/10)')) {
        store.acknowledgePunishment()
        setActivePunishment(null)
      } else {
        setActivePunishment(active)
      }

      const userSettings = await store.fetchSettingsApi()
      if (!isMounted) return;
      setSettings(userSettings)

      await Promise.all([
        store.fetchPunishmentsApi(),
        store.fetchRewardsApi(),
        store.fetchTemplatesApi()
      ])
      if (!isMounted) return;
      setActivePunishment(store.getActivePunishment())
    }

    loadUserData()
    return () => { isMounted = false; }
  }, [currentDateStr, user])

  // Load daily tasks & reflection per user & date
  useEffect(() => {
    let isMounted = true;

    setReflection(store.getReflection(currentDateStr));
    store.fetchReflectionApi(currentDateStr).then(syncedRef => {
      if (isMounted && syncedRef !== undefined) {
        setReflection(syncedRef || '');
      }
    });

    const loadTasks = async () => {
      const isTaskRewardUnacknowledged = (t) => {
        if (!t.reward) return false;
        const targetId = t.id || t._id;
        try {
          if (sessionStorage.getItem(`dayscore_reward_ack_${targetId}`) || localStorage.getItem(`dayscore_reward_ack_${targetId}`)) {
            return false;
          }
        } catch (e) {}
        const isClaimed = t.rewardClaimed === true || t.rewardClaimed === 1 || t.reward_claimed === 1 || t.reward_claimed === '1';
        const isAck = t.rewardAcknowledged === true || t.rewardAcknowledged === 1 || t.reward_acknowledged === 1 || t.reward_acknowledged === '1';
        return !isClaimed && !isAck;
      };

      const cached = store.getTasks(currentDateStr);
      if (cached && cached.length > 0) {
        setTasks(cached);
        const cachedUnack = cached.find(isTaskRewardUnacknowledged);
        setTodaysReward(cachedUnack ? cachedUnack.reward : null);
        setLoading(false);
      } else {
        setLoading(true);
      }

      await store.fetchAllTasksApi();
      if (!isMounted) return;

      const freshToday = store.getTasks(currentDateStr);
      setTasks(freshToday);
      setArchives(store.getAllArchives());
      setLoading(false);

      const unacknowledgedTask = freshToday.find(isTaskRewardUnacknowledged);
      setTodaysReward(unacknowledgedTask ? unacknowledgedTask.reward : null);

      // Check ALL past dates for unfinished / missed task dates for notification banner
      const allArcs = store.getAllArchives();
      const unfinishedSet = new Set();
      allArcs.forEach(arc => {
        if (arc.date && arc.date < todayStr && Array.isArray(arc.tasks)) {
          const hasPending = arc.tasks.some(t => t.status === 'missed' || t.status === 'pending' || t.status === 'inprogress');
          if (hasPending) {
            unfinishedSet.add(arc.date);
          }
        }
      });
      const datesList = Array.from(unfinishedSet).sort();
      setPastUnfinishedDates(datesList);

      try {
        const isDismissed = sessionStorage.getItem(`dayscore_dismiss_pending_${todayStr}`);
        if (!isDismissed && datesList.length > 0) {
          setShowPastPendingBanner(true);
        }
      } catch (e) {}
    }

    loadTasks();
    return () => { isMounted = false; }
  }, [currentDateStr, user, todayStr])

  // Score, Streak & Averages Calculation effect
  useEffect(() => {
    const result = scoring.calculateDailyScore(tasks);
    setScoreResult(result);

    const updatedArchives = store.getAllArchives();
    setArchives(updatedArchives);

    const updatedStreak = scoring.getStreakAsOfDate(updatedArchives, currentDateStr);
    setStreak(updatedStreak);

    setAverages({
      week: scoring.getRollingAverage(updatedArchives, 7, tasks),
      month: scoring.getRollingAverage(updatedArchives, 30, tasks),
      allTime: scoring.getRollingAverage(updatedArchives, 0, tasks)
    });
  }, [tasks, currentDateStr, todayStr]);

  // Auto-process past and overdue tasks:
  // - Tasks on past dates with future due time -> move to target due date
  // - Tasks on past dates with expired due time or no due time -> stay on original date & marked as missed
  useEffect(() => {
    let isMounted = true;
    const processPastAndOverdueTasks = async () => {
      const now = new Date();
      const allArcs = store.getAllArchives();
      let updated = false;

      for (const arc of allArcs) {
        if (!arc.date || !Array.isArray(arc.tasks)) continue;

        for (const task of arc.tasks) {
          if (task.status !== 'done') {
            const due = task.dueDateTime || task.due_date_time;
            const { hasRatedNote, avgRating } = calculateTaskAutoRating(task);
            
            if (due) {
              const dueDateObj = new Date(due);
              const targetDueDateStr = format(dueDateObj, 'yyyy-MM-dd');

              if (targetDueDateStr > arc.date && targetDueDateStr <= todayStr && dueDateObj >= now) {
                if (task.status === 'missed') {
                  await store.updateTask(arc.date, task.id || task._id, { status: 'pending' });
                  updated = true;
                } else {
                  await store.updateTask(arc.date, task.id || task._id, { date: targetDueDateStr });
                  updated = true;
                }
              } else if (dueDateObj < now) {
                const finalStatus = 'done';
                const finalRating = hasRatedNote ? avgRating : 0;
                const shouldMoveDate = targetDueDateStr && targetDueDateStr !== arc.date && targetDueDateStr <= todayStr;
                if (task.status !== finalStatus || task.rating !== finalRating || shouldMoveDate) {
                  const updates = {
                    status: finalStatus,
                    completed: true,
                    completedAt: task.completedAt || task.completed_at || now.toISOString(),
                    completed_at: task.completedAt || task.completed_at || now.toISOString(),
                    rating: finalRating
                  };
                  if (shouldMoveDate) {
                    updates.date = targetDueDateStr;
                  }
                  await store.updateTask(arc.date, task.id || task._id, updates);
                  updated = true;
                }
              }
            } else if (arc.date < todayStr) {
              const finalStatus = 'done';
              const finalRating = hasRatedNote ? avgRating : 0;
              if (task.status !== finalStatus || task.rating !== finalRating) {
                const updates = {
                  status: finalStatus,
                  completed: true,
                  completedAt: task.completedAt || task.completed_at || now.toISOString(),
                  completed_at: task.completedAt || task.completed_at || now.toISOString(),
                  rating: finalRating
                };
                await store.updateTask(arc.date, task.id || task._id, updates);
                updated = true;
              }
            }
          } else {
            const { hasRatedNote, avgRating } = calculateTaskAutoRating(task);
            if (hasRatedNote && task.rating !== avgRating) {
              await store.updateTask(arc.date, task.id || task._id, { rating: avgRating });
              updated = true;
            }
          }
        }
      }

      if (updated && isMounted) {
        await store.fetchAllTasksApi();
        setTasks(store.getTasks(currentDateStr));
        setArchives(store.getAllArchives());
      }
    };

    processPastAndOverdueTasks();
    const interval = setInterval(processPastAndOverdueTasks, 10000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [currentDateStr, todayStr]);

  // Hooks
  const handleRollover = useCallback(() => {
    // Archive current day before rollover
    const currentTasks = store.getTasks(currentDateStr)
    if (currentTasks.length > 0) {
      const result = scoring.calculateDailyScore(currentTasks)

      // Apply punishment if score < 5
      if (result.score < 5) {
        const punishments = store.getPunishments()
        if (punishments.length > 0) {
          const randomPunishment = punishments[Math.floor(Math.random() * punishments.length)]
          store.setActivePunishment(randomPunishment)
        }
      }
    }
    // Refresh date string which triggers re-renders and re-fetches
    setCurrentDateStr(format(new Date(), 'yyyy-MM-dd'))
  }, [currentDateStr])

  useDayRollover(currentDateStr, tasks, handleRollover)
  useNotifications(tasks, settings.notifications, settings.reminderLeadTime ?? 30)

  const handleAddTask = async (newTask) => {
    // 1. Close modal instantly for 0ms delay UX
    setShowAddModal(false);

    // 2. Create optimistic task object
    const tempId = `temp-add-${Date.now()}`;
    const optimisticTask = {
      id: tempId,
      _id: tempId,
      title: newTask.title,
      category: newTask.category || 'General',
      priority: newTask.priority || 'Med',
      dueDateTime: newTask.dueDateTime || null,
      due_date_time: newTask.dueDateTime || null,
      status: 'pending',
      date: todayStr,
      isOptimistic: true,
      createdAt: new Date().toISOString()
    };

    // 3. Insert optimistic task immediately into UI state
    setTasks(prev => [optimisticTask, ...prev]);

    try {
      // 4. Save to backend API and sync store
      await store.addTask(todayStr, newTask);
      await store.fetchAllTasksApi();
    } catch (err) {
      console.error('Failed to save task:', err);
    } finally {
      // 5. Replace optimistic task with actual server task from store
      setTasks(store.getTasks(currentDateStr));
      setArchives(store.getAllArchives());
    }
  };

  const handleCarryOver = async (task) => {
    if (!task) return;
    const targetId = task.id || task._id;
    const sourceDate = task.sourceDate || task.date || task.dateLabel || currentDateStr;

    // 1. Mark past task as missed on its original date
    await store.updateTask(sourceDate, targetId, { status: 'missed' });

    // 2. Create new pending task on TODAY's date (todayStr)
    const newTask = {
      title: task.title,
      category: task.category || 'Work',
      priority: task.priority || 'Med',
      dueDateTime: task.dueDateTime || task.due_date_time || null,
      due_date_time: task.dueDateTime || task.due_date_time || null,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await store.addTask(todayStr, newTask);
    await store.fetchAllTasksApi();

    // 3. Refresh local view state
    setTasks(store.getTasks(currentDateStr));
    setArchives(store.getAllArchives());
    setCarryOverTasks(prev => prev.filter(t => (t.id || t._id) !== targetId));
  }

  const handleDismissCarryOver = async (task) => {
    if (!task) return;
    const targetId = task.id || task._id;
    const sourceDate = task.sourceDate || task.date || task.dateLabel || currentDateStr;

    // Mark past task as missed on its original date
    await store.updateTask(sourceDate, targetId, { status: 'missed' });
    await store.fetchAllTasksApi();

    // Refresh local view state
    setTasks(store.getTasks(currentDateStr));
    setArchives(store.getAllArchives());
    setCarryOverTasks(prev => prev.filter(t => (t.id || t._id) !== targetId));
  }

  const handleCarryOverAll = async () => {
    if (carryOverTasks.length === 0) return;
    const tasksToProcess = [...carryOverTasks];
    for (const task of tasksToProcess) {
      await handleCarryOver(task);
    }
  }

  const isTaskTimeOver = useCallback((task) => {
    if (!task) return false;
    const now = new Date();
    const dueDateStr = task.dueDateTime || task.due_date_time;
    if (dueDateStr) {
      const dueObj = new Date(dueDateStr);
      if (!isNaN(dueObj.getTime())) {
        return dueObj <= now;
      }
    }
    const taskDate = task.date || task.dateLabel;
    if (taskDate) {
      return taskDate < todayStr;
    }
    return false;
  }, [todayStr]);

  // Auto-calculate task completion/missed status from daily note ratings ONLY IF task end date & time has overed (0s time remaining)
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;

    let modified = false;
    const now = new Date();

    tasks.forEach(async (task) => {
      if (!isTaskTimeOver(task)) return; // ONLY evaluate if task end date & time has overed (0s time)

      const { hasRatedNote, avgRating } = calculateTaskAutoRating(task);
      const targetId = task.id || task._id;
      const taskDate = task.date || task.dateLabel || currentDateStr;

      if (hasRatedNote) {
        if (task.status !== 'done' || task.rating !== avgRating) {
          modified = true;

          await store.updateTask(taskDate, targetId, {
            status: 'done',
            completed: true,
            completedAt: task.completedAt || task.completed_at || now.toISOString(),
            completed_at: task.completedAt || task.completed_at || now.toISOString(),
            rating: avgRating,
            maxRating: task.maxRating || task.max_rating || 10,
            max_rating: task.maxRating || task.max_rating || 10
          });
        }
      } else {
        if (task.status !== 'done' && task.status !== 'missed') {
          modified = true;
          await store.updateTask(taskDate, targetId, {
            status: 'missed'
          });
        }
      }
    });

    if (modified) {
      store.fetchAllTasksApi().then(() => {
        setTasks(store.getTasks(currentDateStr));
      });
    }
  }, [tasks, currentDateStr, isTaskTimeOver]);

  const handleAddDailyNote = async (targetTask, noteText, noteRating) => {
    if (!targetTask || !noteText || !noteText.trim()) return;
    if (currentDateStr < todayStr) return; // Daily progress notes addition only works on Today's date
    if (targetTask.status === 'done' || targetTask.status === 'missed') return; // Cannot add notes to completed/missed tasks

    const targetId = targetTask.id || targetTask._id;
    const taskDate = targetTask.date || targetTask.dateLabel || currentDateStr;
    const existingNotes = Array.isArray(targetTask.daily_notes || targetTask.dailyNotes)
      ? (targetTask.daily_notes || targetTask.dailyNotes)
      : [];

    const alreadyHasNoteForToday = existingNotes.some(n => {
      if (!n || !n.date) return false;
      return String(n.date).split('T')[0] === todayStr;
    });

    if (alreadyHasNoteForToday) {
      console.warn('A note for today has already been submitted.');
      return;
    }

    const newNote = {
      id: Date.now().toString(),
      date: todayStr,
      note: noteText.trim(),
      rating: noteRating !== undefined && noteRating !== null ? Number(noteRating) : 8.0,
      created_at: new Date().toISOString()
    };

    const updatedNotes = [...existingNotes, newNote];

    const updates = {
      daily_notes: updatedNotes,
      dailyNotes: updatedNotes
    };

    const now = new Date();
    const { hasRatedNote, avgRating } = calculateTaskAutoRating({ ...targetTask, daily_notes: updatedNotes, dailyNotes: updatedNotes });

    // ONLY perform automatic completion/missed status calculation IF task end date & time has overed (0s time remaining)
    if (isTaskTimeOver(targetTask) || hasRatedNote) {
      if (hasRatedNote) {
        const maxRating = targetTask.maxRating || targetTask.max_rating || 10;

        let dueDateObj = null;
        if (targetTask?.dueDateTime) {
          dueDateObj = new Date(targetTask.dueDateTime);
        } else if (targetTask?.due_date_time) {
          dueDateObj = new Date(targetTask.due_date_time);
        }
        const isOverdue = dueDateObj && !isNaN(dueDateObj.getTime()) && dueDateObj < now;

        const isLowRating = avgRating <= 4;
        const isHighRating = avgRating >= 9;

        let taskReward = null;
        let taskPenalty = null;
        let shouldTriggerPenalty = false;
        let shouldTriggerReward = false;

        const triggeredPenalty = isLowRating || isOverdue;

        if (triggeredPenalty) {
          const punishments = store.getPunishments();
          if (punishments && punishments.length > 0) {
            taskPenalty = punishments[Math.floor(Math.random() * punishments.length)];
            shouldTriggerPenalty = true;
          }
        }

        const currentPunishment = store.getActivePunishment();
        const isPenaltyCurrentlyActive = currentPunishment && !currentPunishment.acknowledged;
        if (isHighRating && !isOverdue && !isPenaltyCurrentlyActive) {
          const rewards = store.getRewards();
          taskReward = (rewards && rewards.length > 0)
            ? rewards[Math.floor(Math.random() * rewards.length)]
            : "Treat yourself!";
          shouldTriggerReward = true;
        }

        updates.status = 'done';
        updates.completed = true;
        updates.completedAt = now.toISOString();
        updates.completed_at = now.toISOString();
        updates.rating = avgRating;
        updates.maxRating = maxRating;
        updates.max_rating = maxRating;
        updates.reward = taskReward;
        updates.penalty = taskPenalty;
        updates.rewardClaimed = false;
        updates.reward_claimed = 0;
        updates.rewardAcknowledged = false;
        updates.reward_acknowledged = 0;
        updates.penaltyAccepted = false;
        updates.penalty_accepted = 0;

        if (shouldTriggerPenalty && taskPenalty) {
          store.setActivePunishment(taskPenalty);
          setActivePunishment(store.getActivePunishment());
          setShowConfetti(false);
          setShowPenaltyFlash(true);
          setTimeout(() => setShowPenaltyFlash(false), 3000);
        } else if (shouldTriggerReward && taskReward) {
          setTodaysReward(taskReward);
          setShowPenaltyFlash(false);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
        }
      } else if (isTaskTimeOver(targetTask)) {
        updates.status = 'done';
        updates.completed = true;
        updates.completedAt = now.toISOString();
        updates.completed_at = now.toISOString();
        updates.rating = 0;
      }
    }

    await store.updateTask(taskDate, targetId, updates);

    await store.fetchAllTasksApi();
    setTasks(store.getTasks(currentDateStr));
    setArchives(store.getAllArchives());
  };

  const handleAutoCompleteWithRating = async (task, computedRating) => {
    if (!task) return;
    const targetId = task.id || task._id;
    await handleRatingConfirm(targetId, computedRating, 10);
  };

  const handleStatusChange = async (taskOrId, newStatus) => {
    const isObject = typeof taskOrId === 'object' && taskOrId !== null;
    const taskId = isObject ? (taskOrId.id || taskOrId._id) : taskOrId;
    const taskDate = isObject ? (taskOrId.date || taskOrId.dateLabel || currentDateStr) : currentDateStr;
    const currentTask = isObject ? taskOrId : tasks.find(t => t.id === taskId || t._id === taskId);

    if (currentTask && currentTask.status === 'missed' && newStatus !== 'missed') {
      return;
    }

    const updates = { status: newStatus }
    if (newStatus === 'done') {
      updates.completedAt = new Date().toISOString()
      updates.completed_at = new Date().toISOString()
    } else if (newStatus === 'pending' || newStatus === 'inprogress') {
      updates.completedAt = null
      updates.completed_at = null
      updates.rating = null
      updates.reward = null
      updates.penalty = null
      updates.rewardClaimed = false
      updates.reward_claimed = 0
      updates.penaltyAccepted = false
      updates.penalty_accepted = 0
    }
    await store.updateTask(taskDate, taskId, updates)
    await store.fetchAllTasksApi()
    setTasks(store.getTasks(currentDateStr))
    setArchives(store.getAllArchives())
  }

  const showToast = useCallback((msg) => {
    setDateWarningToast(msg);
    setTimeout(() => {
      setDateWarningToast(prev => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  // Rating flow: open slider modal instead of directly completing
  const handleRequestComplete = (task) => {
    if (!task) return;
    // On older/past dates (currentDateStr < todayStr), past tasks cannot be completed
    if (currentDateStr < todayStr) return;

    setRatingTask(task);
  }

  const handleRatingConfirm = async (ratingTaskId, rating, maxRating) => {
    const targetTask = ratingTask || tasks.find(t => t.id === ratingTaskId || t._id === ratingTaskId)
    if (targetTask && targetTask.status === 'missed' && currentDateStr < todayStr) {
      setRatingTask(null);
      return;
    }
    const taskDate = targetTask?.date || targetTask?.dateLabel || currentDateStr;
    const targetId = targetTask?.id || targetTask?._id || ratingTaskId;

    const now = new Date()

    let dueDateObj = null
    if (targetTask?.dueDateTime) {
      dueDateObj = new Date(targetTask.dueDateTime)
    } else if (targetTask?.due_date_time) {
      dueDateObj = new Date(targetTask.due_date_time)
    }
    const isOverdue = dueDateObj && !isNaN(dueDateObj.getTime()) && dueDateObj < now

    const numRating = Number(rating)
    const isLowRating = numRating <= 4
    const isHighRating = numRating >= 9

    let taskReward = null
    let taskPenalty = null

    let shouldTriggerPenalty = false
    let shouldTriggerReward = false

    const triggeredPenalty = isLowRating || isOverdue

    // Trigger Penalty if individual task rating is <= 4 OR if task was completed overdue
    if (triggeredPenalty) {
      const punishments = store.getPunishments()
      if (punishments && punishments.length > 0) {
        const randomPunishment = punishments[Math.floor(Math.random() * punishments.length)]
        taskPenalty = randomPunishment
        shouldTriggerPenalty = true
      }
    }

    const currentPunishment = store.getActivePunishment()
    const isPenaltyCurrentlyActive = currentPunishment && !currentPunishment.acknowledged
    // Reward Trigger: ONLY if this specific task has a rating >= 9 and not overdue or penalty active
    if (isHighRating && !isOverdue && !isPenaltyCurrentlyActive) {
      const rewards = store.getRewards()
      taskReward = (rewards && rewards.length > 0)
        ? rewards[Math.floor(Math.random() * rewards.length)]
        : "Treat yourself!"

      shouldTriggerReward = true
    }



    const wasMissedTask = targetTask?.status === 'missed' || targetTask?.wasMissed || targetTask?.was_missed;

    const updates = {
      status: 'done',
      completedAt: now.toISOString(),
      completed_at: now.toISOString(),
      rating,
      maxRating,
      max_rating: maxRating,
      reward: taskReward,
      penalty: taskPenalty,
      rewardClaimed: false,
      reward_claimed: 0,
      rewardAcknowledged: false,
      reward_acknowledged: 0,
      penaltyAccepted: false,
      penalty_accepted: 0,
      wasMissed: wasMissedTask ? true : undefined,
      was_missed: wasMissedTask ? 1 : undefined
    }
    await store.updateTask(taskDate, targetId, updates)
    await store.fetchAllTasksApi()
    setTasks(store.getTasks(currentDateStr))
    setArchives(store.getAllArchives())

    // Close the rating modal FIRST so UI resets
    setRatingTask(null)

    // After modal closes, trigger rewards/penalties banner & animations
    const pendingPenalty = taskPenalty;
    const pendingReward = taskReward;
    const pendingTriggerPenalty = shouldTriggerPenalty;
    const pendingTriggerReward = shouldTriggerReward;

    setTimeout(() => {
      if (pendingTriggerPenalty && pendingPenalty) {
        store.setActivePunishment(pendingPenalty)
        setActivePunishment(store.getActivePunishment())
        setShowConfetti(false)
        setShowPenaltyFlash(true)
        setTimeout(() => setShowPenaltyFlash(false), 3000)
      } else if (pendingTriggerReward && pendingReward) {
        setTodaysReward(pendingReward)
        setShowPenaltyFlash(false)
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 3000)
      }
    }, 150)
  }

  const handleRatingCancel = () => {
    setRatingTask(null)
  }

  const handleDeleteTask = async (taskOrId) => {
    const isObject = typeof taskOrId === 'object' && taskOrId !== null;
    const taskId = isObject ? (taskOrId.id || taskOrId._id) : taskOrId;
    const taskDate = isObject ? (taskOrId.date || taskOrId.dateLabel || currentDateStr) : currentDateStr;

    // Animate out first
    setDeletingTaskIds(prev => new Set(prev).add(taskId))
    // Wait for animation to finish (matches CSS taskSlideOut 0.4s)
    await new Promise(resolve => setTimeout(resolve, 400))

    await store.deleteTask(taskDate, taskId)
    await store.fetchAllTasksApi()
    setTasks(store.getTasks(currentDateStr))
    setArchives(store.getAllArchives())
    setDeletingTaskIds(prev => { const s = new Set(prev); s.delete(taskId); return s; })
  }



  const [ackPunishmentLoading, setAckPunishmentLoading] = useState(false)
  const [ackRewardLoading, setAckRewardLoading] = useState(false)

  const handleAcknowledgePunishment = async () => {
    if (ackPunishmentLoading) return;
    setAckPunishmentLoading(true);
    try {
      // Case 2: Update penalty_acknowledged: 1 when clicking on "I Acknowledge" top banner button; DO NOT store in claimlogs.
      store.acknowledgePunishment()
      setActivePunishment(null)

      const unackTasks = tasks.filter(t => {
        const isAck = t.penaltyAcknowledged === true || t.penaltyAcknowledged === 1 || t.penalty_acknowledged === 1 || t.penalty_acknowledged === '1';
        return !isAck;
      });

      for (const t of unackTasks) {
        const targetId = t.id || t._id;
        await store.updateTask(currentDateStr, targetId, {
          penaltyAcknowledged: true,
          penalty_acknowledged: 1
        });
      }

      const freshTasks = await store.fetchTasksApi(currentDateStr);
      setTasks(freshTasks);
      setActivePunishment(null);
    } finally {
      setAckPunishmentLoading(false);
    }
  }

  const handleAcknowledgeReward = async () => {
    if (ackRewardLoading) return;
    setAckRewardLoading(true);
    try {
      setTodaysReward(null)

      // Mark unacknowledged task rewards for today as acknowledged in MongoDB Atlas and local cache
      const unackTasks = tasks.filter(t => {
        if (!t.reward) return false;
        const isAck = t.rewardAcknowledged === true || t.rewardAcknowledged === 1 || t.reward_acknowledged === 1 || t.reward_acknowledged === '1';
        return !isAck;
      });

      for (const t of unackTasks) {
        const targetId = t.id || t._id;
        try {
          sessionStorage.setItem(`dayscore_reward_ack_${targetId}`, '1');
          localStorage.setItem(`dayscore_reward_ack_${targetId}`, '1');
        } catch (e) {}

        await store.updateTask(currentDateStr, targetId, {
          rewardAcknowledged: true,
          reward_acknowledged: 1
        });
      }

      const freshTasks = await store.fetchTasksApi(currentDateStr);
      setTasks(freshTasks);
    } finally {
      setAckRewardLoading(false);
    }
  }

  const handleClaimTaskReward = async (taskOrId) => {
    const isObject = typeof taskOrId === 'object' && taskOrId !== null;
    const targetId = isObject ? (taskOrId.id || taskOrId._id) : taskOrId;
    const targetDate = isObject ? (taskOrId.date || taskOrId.dateLabel || currentDateStr) : currentDateStr;

    await store.updateTask(targetDate, targetId, {
      rewardClaimed: true,
      reward_claimed: 1,
      rewardAcknowledged: true,
      reward_acknowledged: 1,
      penaltyAccepted: false,
      penalty_accepted: 0,
      rewardClaimedAt: new Date().toISOString()
    })
    await store.fetchAllTasksApi()
    setTasks(store.getTasks(currentDateStr))
    setArchives(store.getAllArchives())
    setTodaysReward(null)
  }

  const handleAcceptTaskPenalty = async (taskOrId) => {
    const isObject = typeof taskOrId === 'object' && taskOrId !== null;
    const targetId = isObject ? (taskOrId.id || taskOrId._id) : taskOrId;
    const targetDate = isObject ? (taskOrId.date || taskOrId.dateLabel || currentDateStr) : currentDateStr;

    await store.updateTask(targetDate, targetId, {
      penaltyAccepted: true,
      penalty_accepted: 1,
      rewardClaimed: false,
      reward_claimed: 0,
      penaltyAcceptedAt: new Date().toISOString()
    })
    await store.fetchAllTasksApi()
    setTasks(store.getTasks(currentDateStr))
    setArchives(store.getAllArchives())

    store.acknowledgePunishment()
    setActivePunishment(null)
  }

  const sortTasksByDefaultHierarchy = (a, b) => {
    // Status Group Tier Hierarchy (Top to Bottom):
    // Tier 1: 🔴 Missed Tasks (Non-Carried)
    // Tier 2: 🔄🔴 Missed Carried-Over Tasks
    // Tier 3: ⏳ Pending Tasks (Non-Carried)
    // Tier 4: 🔄⏳ Carried-Over Pending Tasks
    // Tier 5: 🟢 Completed Tasks with pending claim / acknowledge action
    // Tier 6: 🟢 Fully Completed Tasks
    const getStatusTier = (t) => {
      const isCarried = isCarriedTask(t);
      const isDone = t.status === 'done' || t.completed === true;
      const isMissed = t.status === 'missed' || t.missed === true;

      // Tier 1 & 2: Missed Tasks
      if (isMissed) {
        if (!isCarried) return 1; // Tier 1: Missed (Non-Carried)
        return 2;                // Tier 2: Missed Carried
      }

      // Tier 3 & 4: Unfinished Tasks (pending / inprogress)
      if (!isDone) {
        if (!isCarried) return 3; // Tier 3: Pending (Non-Carried)
        return 4;                // Tier 4: Carried Pending
      }

      // For Completed / Done Tasks (t.status === 'done'):
      const isRewardClaimed = t.rewardClaimed === true || t.rewardClaimed === 1 || t.rewardClaimed === '1' ||
                        t.reward_claimed === true || t.reward_claimed === 1 || t.reward_claimed === '1';
      const isPenaltyAccepted = t.penaltyAccepted === true || t.penaltyAccepted === 1 || t.penaltyAccepted === '1' ||
                         t.penalty_accepted === true || t.penalty_accepted === 1 || t.penalty_accepted === '1';

      const ratingNum = t.rating != null && !isNaN(Number(t.rating)) ? Number(t.rating) : null;
      const hasLowRatingPenalty = ratingNum != null && ratingNum <= 4.0;
      const hasHighRatingReward = ratingNum != null && ratingNum > 4.0;

      const hasUnclaimedReward = Boolean(t.reward && hasHighRatingReward && !isRewardClaimed);
      const hasUnacknowledgedPenalty = Boolean(t.penalty && hasLowRatingPenalty && !isPenaltyAccepted);

      // Tier 5: Completed Tasks with pending claim / acknowledge
      if (hasUnclaimedReward || hasUnacknowledgedPenalty) {
        return 5;
      }

      // Tier 6: Fully Completed Tasks
      return 6;
    };

    const tierA = getStatusTier(a);
    const tierB = getStatusTier(b);

    if (tierA !== tierB) {
      return tierA - tierB;
    }

    // Tiers 1 & 2 (Missed Tasks & Missed Carried Tasks): Sort by most recent ended DESCENDING (newest ended first)
    if (tierA === 1 || tierA === 2) {
      const getMissedEndedTimestamp = (t) => {
        const iso = t.dueDateTime || t.due_date_time || t.date || t.originalDate || t.original_date || t.createdAt || t.created_at;
        if (!iso) return 0;
        const ms = new Date(iso.includes('T') ? iso : `${iso}T23:59:59`).getTime();
        return isNaN(ms) ? 0 : ms;
      };
      const endA = getMissedEndedTimestamp(a);
      const endB = getMissedEndedTimestamp(b);
      if (endA !== endB) return endB - endA;
    }

    // Tiers 3 & 4 (Pending Tasks & Carried Pending Tasks): Sort by most recent ending / nearest due time ASCENDING (soonest ending first)
    if (tierA === 3 || tierA === 4) {
      const getTaskDueTimestamp = (t) => {
        const dueStr = t.dueDateTime || t.due_date_time;
        if (dueStr) {
          const ms = new Date(dueStr).getTime();
          if (!isNaN(ms)) return ms;
        }
        const dateStr = t.date || t.originalDate || t.original_date;
        if (dateStr) {
          const ms = new Date(`${dateStr}T23:59:59`).getTime();
          if (!isNaN(ms)) return ms;
        }
        const createdStr = t.createdAt || t.created_at;
        if (createdStr) {
          const ms = new Date(createdStr).getTime();
          if (!isNaN(ms)) return ms;
        }
        return 9999999999999;
      };
      const dueA = getTaskDueTimestamp(a);
      const dueB = getTaskDueTimestamp(b);
      if (dueA !== dueB) return dueA - dueB;
    }

    // Tiers 5 & 6 (Completed Tasks): Sort by most recent completed DESCENDING (latest completed first)
    if (tierA === 5 || tierA === 6) {
      const getCompletedTimestamp = (t) => {
        const iso = t.completedAt || t.completed_at || t.updatedAt || t.updated_at || t.date || t.createdAt;
        if (!iso) return 0;
        const ms = new Date(iso).getTime();
        return isNaN(ms) ? 0 : ms;
      };
      const compA = getCompletedTimestamp(a);
      const compB = getCompletedTimestamp(b);
      if (compA !== compB) return compB - compA;
    }

    return 0;
  };

  const displayTasksList = useMemo(() => {
    const rawList = viewMode === 'all' ? allTasksAcrossDates : tasks;
    let list = [...rawList];

    // --- 1. SEARCH FILTERING (Strictly show ONLY matched tasks) ---
    const trimmedSearch = searchQuery.trim().toLowerCase();
    if (trimmedSearch) {
      list = list.filter(t => (t.title || '').toLowerCase().includes(trimmedSearch));
    }

    // --- 2. CATEGORY, PRIORITY, STATUS, RATING, DATE FILTERING ---
    // Category Filter
    if (filterCategory !== 'all') {
      list = list.filter(t => (t.category || 'Work').toLowerCase() === filterCategory.toLowerCase());
    }

    // Priority Filter
    if (filterPriority !== 'all') {
      list = list.filter(t => (t.priority || 'Med').toLowerCase() === filterPriority.toLowerCase());
    }

    // Status / Special Type Filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'pending') {
        list = list.filter(t => t.status === 'pending' || t.status === 'inprogress');
      } else if (filterStatus === 'done') {
        list = list.filter(t => t.status === 'done');
      } else if (filterStatus === 'missed') {
        list = list.filter(t => t.status === 'missed');
      } else if (filterStatus === 'carriedOver') {
        list = list.filter(t => isCarriedTask(t));
      } else if (filterStatus === 'reward') {
        list = list.filter(t => Boolean(t.reward));
      } else if (filterStatus === 'penalty') {
        list = list.filter(t => Boolean(t.penalty));
      } else if (filterStatus === 'unclaimedReward') {
        list = list.filter(t => {
          if (!t.reward) return false;
          const isClaimed = t.rewardClaimed === true || t.rewardClaimed === 1 || t.reward_claimed === 1 || t.reward_claimed === '1';
          return !isClaimed;
        });
      } else if (filterStatus === 'unackPenalty') {
        list = list.filter(t => {
          if (!t.penalty) return false;
          const isAccepted = t.penaltyAccepted === true || t.penaltyAccepted === 1 || t.penalty_accepted === 1 || t.penalty_accepted === '1';
          return !isAccepted;
        });
      }
    }

    // Rating Filter
    if (filterRatingRange !== 'all') {
      if (filterRatingRange === 'red') {
        list = list.filter(t => t.status === 'done' && t.rating != null && Number(t.rating) <= 4.0);
      } else if (filterRatingRange === 'blue') {
        list = list.filter(t => t.status === 'done' && t.rating != null && Number(t.rating) > 4.0 && Number(t.rating) <= 8.5);
      } else if (filterRatingRange === 'green') {
        list = list.filter(t => t.status === 'done' && t.rating != null && Number(t.rating) > 8.5);
      } else {
        const targetR = Number(filterRatingRange);
        if (!isNaN(targetR)) {
          list = list.filter(t => t.status === 'done' && t.rating != null && Math.abs(Number(t.rating) - targetR) < 0.25);
        }
      }
    }

    // Date Range Filter
    if (filterDateFrom) {
      list = list.filter(t => {
        const tDate = t.date || (t.createdAt ? t.createdAt.substring(0, 10) : currentDateStr);
        return tDate >= filterDateFrom;
      });
    }
    if (filterDateTo) {
      list = list.filter(t => {
        const tDate = t.date || (t.createdAt ? t.createdAt.substring(0, 10) : currentDateStr);
        return tDate <= filterDateTo;
      });
    }

    // Helper: Near ending / upcoming due task urgency timestamp
    const getNearEndingUrgency = (t) => {
      const due = t.dueDateTime || t.due_date_time;
      if (!due) return 9999999999999;
      return new Date(due).getTime();
    };

    // --- 3. SORTING ---
    list.sort((a, b) => {
      if (sortOption === 'urgency') {
        const urgencyDiff = getNearEndingUrgency(a) - getNearEndingUrgency(b);
        if (urgencyDiff !== 0) return urgencyDiff;
      } else if (sortOption === 'rating_desc') {
        const rA = a.rating != null ? Number(a.rating) : -1;
        const rB = b.rating != null ? Number(b.rating) : -1;
        if (rA !== rB) return rB - rA;
      } else if (sortOption === 'rating_asc') {
        const rA = a.rating != null ? Number(a.rating) : 999;
        const rB = b.rating != null ? Number(b.rating) : 999;
        if (rA !== rB) return rA - rB;
      } else if (sortOption === 'title_asc') {
        const titleA = (a.title || '').toLowerCase();
        const titleB = (b.title || '').toLowerCase();
        if (titleA !== titleB) return titleA.localeCompare(titleB);
      } else if (sortOption === 'category') {
        const catOrderMap = { health: 1, learning: 2, work: 3, personal: 4 };
        const orderA = catOrderMap[(a.category || '').toLowerCase()] || 99;
        const orderB = catOrderMap[(b.category || '').toLowerCase()] || 99;
        if (orderA !== orderB) return orderA - orderB;
      } else if (sortOption === 'created_desc') {
        const cA = new Date(a.createdAt || a.created_at || 0).getTime();
        const cB = new Date(b.createdAt || b.created_at || 0).getTime();
        if (cA !== cB) return cB - cA;
      }

      // Default sort: Missed -> Carried -> Pending -> Complete (latest datetime to oldest)
      return sortTasksByDefaultHierarchy(a, b);
    });

    return list;
  }, [
    viewMode,
    allTasksAcrossDates,
    tasks,
    searchQuery,
    sortOption,
    filterCategory,
    filterPriority,
    filterStatus,
    filterRatingRange,
    filterDateFrom,
    filterDateTo,
    currentDateStr
  ]);

  // Restore scroll position after tasks render
  useEffect(() => {
    if (displayTasksList.length > 0 && !hasRestoredScrollRef.current && !loading) {
      const savedPos = sessionStorage.getItem('dayscore_today_scroll_pos');
      if (savedPos != null) {
        const targetScroll = parseInt(savedPos, 10);
        if (!isNaN(targetScroll) && targetScroll > 0) {
          hasRestoredScrollRef.current = true;
          requestAnimationFrame(() => {
            setTimeout(() => {
              setScrollTop(targetScroll);
            }, 120);
          });
        }
      }
    }
  }, [displayTasksList, loading]);

  // Get punishment text safely
  const punishmentText = activePunishment && typeof activePunishment === 'object' && !activePunishment.acknowledged
    ? activePunishment.text
    : null;

  const displayScore = useMemo(() => {
    if (viewMode === 'all') {
      return scoring.calculateOverallAverageTaskScore(archives, tasks);
    }
    return scoreResult.score;
  }, [viewMode, archives, tasks, scoreResult.score]);

  const displayLabel = viewMode === 'all' ? 'Total Avg Score' : 'Daily Score';

  return (
    <div className="today-view animate-slide-up">



      <ConfettiCelebration trigger={showConfetti} />
      <PenaltyCelebration trigger={showPenaltyFlash} />

      {loading ? (
        <div className="today-loading-container">
          <div className="score-display-card-loading">
            <div className="ring-score-loader">
              <svg width="140" height="140" viewBox="0 0 160 160">
                <defs>
                  <linearGradient id="loader-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent-primary)" />
                    <stop offset="100%" stopColor="var(--accent-warning)" />
                  </linearGradient>
                </defs>
                <circle className="bg-circle" cx="80" cy="80" r="70" fill="none" />
                <circle className="glow-circle" cx="80" cy="80" r="70" fill="none" />
              </svg>
              <div className="ring-loader-center">
                <div className="ring-loader-spinner" />
                <div className="skeleton-box" style={{ width: '42px', height: '14px', borderRadius: '4px' }} />
              </div>
            </div>
            <div className="skeleton-box" style={{ width: '120px', height: '12px', borderRadius: '4px', marginBottom: '8px' }} />
            <div className="skeleton-box" style={{ width: '90px', height: '24px', borderRadius: '12px' }} />
          </div>

          <div className="skeleton-box" style={{ width: '100%', height: '64px', borderRadius: 'var(--radius-lg)', margin: '20px 0' }} />

          <div className="task-list-loading">
            {[1, 2, 3].map(n => (
              <div key={n} className="task-card-skeleton">
                <div className="task-skeleton-left">
                  <div className="skeleton-box task-skeleton-circle" />
                  <div className="task-skeleton-lines">
                    <div className="skeleton-box task-skeleton-line-long" />
                    <div className="skeleton-box task-skeleton-line-short" />
                  </div>
                </div>
                <div className="skeleton-box task-skeleton-right" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Date Navigation & View Mode Header */}
          <div className="card-glass date-nav-card" style={{ padding: '6px 12px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 100 }}>
            {viewMode === 'date' ? (
              <div className="date-nav-left" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary btn-sm date-nav-btn"
                  onClick={handlePrevDay}
                  disabled={!canGoPrev}
                  title={canGoPrev ? "Previous Day with Tasks" : "No Earlier Tasks Found"}
                  style={{
                    padding: '4px 9px',
                    height: '30px',
                    fontSize: '0.8rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    opacity: canGoPrev ? 1 : 0.4,
                    cursor: canGoPrev ? 'pointer' : 'not-allowed'
                  }}
                >
                  <ChevronLeft size={14} /> Prev
                </button>

                <CustomDatePicker
                  currentDateStr={currentDateStr}
                  validTaskDates={validTaskDates}
                  todayStr={todayStr}
                  onSelectDate={(newDate) => setCurrentDateStr(newDate)}
                />

                <button
                  className="btn btn-secondary btn-sm date-nav-btn"
                  onClick={handleNextDay}
                  disabled={!canGoNext}
                  title={canGoNext ? "Next Day with Tasks" : "Latest Date Reached"}
                  style={{
                    padding: '4px 9px',
                    height: '30px',
                    fontSize: '0.8rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    opacity: !canGoNext ? 0.4 : 1,
                    cursor: !canGoNext ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next <ChevronRight size={14} />
                </button>

                {currentDateStr !== todayStr && (
                  <button
                    className="btn btn-primary btn-sm date-nav-btn"
                    onClick={handleToday}
                    style={{ padding: '4px 9px', height: '30px', fontSize: '0.8rem' }}
                  >
                    Today
                  </button>
                )}
              </div>
            ) : (
              <div className="date-nav-left" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Layers size={15} style={{ color: 'var(--accent-primary)' }} /> All Tasks View
                </span>
              </div>
            )}

            <div className="view-mode-toggle" style={{ display: 'flex', gap: '3px', background: 'var(--bg-glass-light)', padding: '2px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
              <button
                className={`btn btn-sm ${viewMode === 'date' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleSetViewMode('date')}
                style={{ padding: '4px 10px', height: '28px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Calendar size={13} /> Date View ({tasks.length})
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleSetViewMode('all')}
                style={{ padding: '4px 10px', height: '28px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Layers size={13} /> All Tasks ({allTasksAcrossDates.length})
              </button>
            </div>
          </div>

          <ScoreRing
            score={displayScore}
            label={displayLabel}
            streak={streak}
            averages={averages}
            details={scoreResult}
          />

          {punishmentText ? (
            <div className="penalty-banner">
              <div className="penalty-banner-content">
                <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                <div>
                  <strong className="penalty-banner-title">Penalty Active!</strong>
                  <span className="penalty-banner-text">Your Penalty: <strong>{punishmentText}</strong></span>
                </div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={handleAcknowledgePunishment} disabled={ackPunishmentLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {ackPunishmentLoading ? (
                  <>
                    <Loader2 size={14} className="btn-spinner" /> Saving...
                  </>
                ) : (
                  'I Acknowledge'
                )}
              </button>
            </div>
          ) : (
            todaysReward && (
              <div className="reward-banner">
                <div className="reward-banner-content">
                  <Gift size={24} style={{ flexShrink: 0 }} />
                  <div>
                    <strong className="reward-banner-title">Great job today!</strong>
                    <span className="reward-banner-text">Your Reward: <strong>{todaysReward}</strong></span>
                  </div>
                </div>
                <button className="btn btn-success btn-sm" onClick={handleAcknowledgeReward} disabled={ackRewardLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {ackRewardLoading ? (
                    <>
                      <Loader2 size={14} className="btn-spinner" /> Saving...
                    </>
                  ) : (
                    'I Accept'
                  )}
                </button>
              </div>
            )
          )}

          {autoCarriedToastInfo && (
            <div className="card-glass auto-carried-toast-banner animate-fade-in" style={{
              marginBottom: '16px',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 20px rgba(245, 158, 11, 0.15)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#fef3c7' }}>
                <RotateCcw size={16} style={{ color: '#fbbf24', flexShrink: 0 }} />
                <span>
                  ⚡ <strong>{autoCarriedToastInfo.count} task{autoCarriedToastInfo.count > 1 ? 's' : ''}</strong> automatically carried over to Today!
                </span>
              </div>
              <button
                className="btn btn-sm"
                onClick={() => {
                  if (autoCarriedToastInfo.ackKey) {
                    sessionStorage.setItem(autoCarriedToastInfo.ackKey, 'true');
                  }
                  setAutoCarriedToastInfo(null);
                }}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  padding: '4px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(245, 158, 11, 0.3)'
                }}
              >
                OK
              </button>
            </div>
          )}

          {/* Daily Reflection Section */}
          <div className="reflection-section-top" style={{ marginBottom: '16px' }}>
            <ReflectionBox 
              value={reflection} 
              onChange={(val) => {
                setReflection(val);
                store.saveReflection(currentDateStr, val);
              }} 
            />
          </div>

          {/* Filter, Sort & Search Control Bar */}
          <div className="card-glass task-controls-card" style={{ marginBottom: '16px' }}>
            <div className="compact-task-toolbar">
              
              {/* Left Group: Total Tasks Badge & Stat Chips */}
              <div className="total-tasks-badge-group">
                <div className="total-tasks-badge">
                  <Layers size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <span><strong>{displayTasksList.length}</strong></span>
                </div>
                <div className="total-tasks-stat-group">
                  {displayTasksList.filter(t => t.status !== 'done' && t.status !== 'missed').length > 0 && (
                    <span className="task-stat-chip chip-pending" title="Pending Tasks">
                      <Clock size={12} /> <strong>{displayTasksList.filter(t => t.status !== 'done' && t.status !== 'missed').length}</strong> Pending
                    </span>
                  )}
                  {displayTasksList.filter(t => t.status === 'done' || t.completed === true).length > 0 && (
                    <span className="task-stat-chip chip-done" title="Completed Tasks">
                      <Check size={12} /> <strong>{displayTasksList.filter(t => t.status === 'done' || t.completed === true).length}</strong> Done
                    </span>
                  )}
                  {displayTasksList.filter(t => t.status === 'missed' || t.missed === true).length > 0 && (
                    <span className="task-stat-chip chip-missed" title="Missed Tasks">
                      <AlertTriangle size={12} /> <strong>{displayTasksList.filter(t => t.status === 'missed' || t.missed === true).length}</strong> Missed
                    </span>
                  )}
                  {displayTasksList.filter(t => isCarriedTask(t)).length > 0 && (
                    <span className="task-stat-chip chip-carried" title="Carried Over Tasks">
                      <RotateCcw size={12} /> <strong>{displayTasksList.filter(t => isCarriedTask(t)).length}</strong> Carried
                    </span>
                  )}
                </div>
              </div>

              {/* Right Group: Search, Sort & Filters */}
              <div className="task-actions-group">
                <div className="task-search-input-wrapper">
                  <Search size={15} className="search-icon" />
                  <input
                    type="text"
                    className="task-search-input"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button type="button" className="task-search-clear" onClick={() => setSearchQuery('')}>
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Inline Sort Selection */}
                <div className="task-sort-wrapper">
                  <CustomSelect
                    value={sortOption}
                    onChange={val => setSortOption(val)}
                    options={[
                      { label: '⚡Default', value: 'default' },
                      { label: '⏰Due Time', value: 'urgency' },
                      { label: '★High Rating', value: 'rating_desc' },
                      { label: '★Low Rating', value: 'rating_asc' },
                      { label: '🔤Title (A-Z)', value: 'title_asc' },
                      { label: '📁Category', value: 'category' },
                      { label: '🆕Newest', value: 'created_desc' }
                    ]}
                  />
                </div>

                <button
                  type="button"
                  className={`btn btn-secondary btn-sm task-filter-btn ${activeFilterCount > 0 ? 'active' : ''}`}
                  onClick={() => setShowFilterModal(true)}
                >
                  <SlidersHorizontal size={14} />
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="badge badge-pri" style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '10px' }}>
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

            </div>

            {/* Active Filters Bar & Reset Action */}
            {activeFilterCount > 0 && (
              <div className="active-filter-bar">
                <div className="active-filter-tags">
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600' }}>Active Filters:</span>
                  {searchQuery && (
                    <span className="active-filter-tag">
                      Search: "{searchQuery}" <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
                    </span>
                  )}
                  {sortOption !== 'default' && (
                    <span className="active-filter-tag">
                      Sort: {sortOption} <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSortOption('default')} />
                    </span>
                  )}
                  {filterCategory !== 'all' && (
                    <span className="active-filter-tag">
                      Category: {filterCategory} <X size={12} style={{ cursor: 'pointer' }} onClick={() => setFilterCategory('all')} />
                    </span>
                  )}
                  {filterPriority !== 'all' && (
                    <span className="active-filter-tag">
                      Priority: {filterPriority} <X size={12} style={{ cursor: 'pointer' }} onClick={() => setFilterPriority('all')} />
                    </span>
                  )}
                  {filterStatus !== 'all' && (
                    <span className="active-filter-tag">
                      Status: {filterStatus} <X size={12} style={{ cursor: 'pointer' }} onClick={() => setFilterStatus('all')} />
                    </span>
                  )}
                  {filterRatingRange !== 'all' && (
                    <span className="active-filter-tag">
                      Rating: {filterRatingRange} <X size={12} style={{ cursor: 'pointer' }} onClick={() => setFilterRatingRange('all')} />
                    </span>
                  )}
                  {filterDateFrom && (
                    <span className="active-filter-tag">
                      From: {filterDateFrom} <X size={12} style={{ cursor: 'pointer' }} onClick={() => setFilterDateFrom('')} />
                    </span>
                  )}
                  {filterDateTo && (
                    <span className="active-filter-tag">
                      To: {filterDateTo} <X size={12} style={{ cursor: 'pointer' }} onClick={() => setFilterDateTo('')} />
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={resetAllFilters}
                  style={{ fontSize: '0.75rem', padding: '3px 8px', gap: '4px' }}
                >
                  <RotateCcw size={12} /> Reset All
                </button>
              </div>
            )}
          </div>

          <div className="tasks-section">
            {displayTasksList.length === 0 ? (
              <div className="card-glass empty-state">
                <div className="empty-icon">📝</div>
                <p className="empty-text">
                  {activeFilterCount > 0 
                    ? 'No tasks match the active filters or search criteria.' 
                    : (viewMode === 'all' ? 'No tasks found in MongoDB Atlas!' : `No tasks added for ${currentDateStr} yet!`)}
                </p>
                {activeFilterCount > 0 ? (
                  <button className="btn btn-secondary btn-sm" onClick={resetAllFilters} style={{ gap: '6px' }}>
                    <RotateCcw size={14} /> Clear All Filters
                  </button>
                ) : (
                  isToday && (
                    <button
                      className="btn btn-primary"
                      onClick={handleOpenAddModal}
                    >
                      <Plus size={18} /> Add Your First Task
                    </button>
                  )
                )}
              </div>
            ) : (
              <div className="task-group-list">
                {displayTasksList.map((task, idx) => (
                  <TaskCard
                    key={task.id || task._id}
                    index={idx + 1}
                    task={task}
                    isToday={isToday}
                    animDelay={Math.min(idx * 0.04, 0.3)}
                    isDeleting={deletingTaskIds.has(task.id || task._id)}
                    onStatusChange={(taskId, newStatus) => handleStatusChange(taskId, newStatus)}
                    onDelete={(taskId) => handleDeleteTask(taskId)}
                    onRequestComplete={handleRequestComplete}
                    onAutoCompleteWithRating={handleAutoCompleteWithRating}
                    onClaimReward={handleClaimTaskReward}
                    onAcceptPenalty={handleAcceptTaskPenalty}
                    onAddDailyNote={handleAddDailyNote}
                    onShowToast={showToast}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Floating Action Button (Only show when visiting Today or Future dates) */}
      {(!currentDateStr || currentDateStr >= todayStr) && (
        <button
          className="fab"
          onClick={handleOpenAddModal}
          aria-label="Add Task"
          title="Add New Task"
        >
          <Plus size={28} />
        </button>
      )}

      {showAddModal && currentDateStr >= todayStr && (
        <AddTaskModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddTask}
          templates={store.getTemplates()}
        />
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {ratingTask && (
        <RatingSliderModal
          task={ratingTask}
          onConfirm={handleRatingConfirm}
          onCancel={handleRatingCancel}
        />
      )}

      {showReflectionModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowReflectionModal(false)}>
          <div className="modal-content card-glass animate-scale-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <ReflectionBox
              value={reflection}
              onChange={(val) => {
                setReflection(val);
                store.saveReflection(currentDateStr, val);
              }}
              isModal={true}
              onClose={() => setShowReflectionModal(false)}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Advanced Filter Modal */}
      {showFilterModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowFilterModal(false)}>
          <div className="modal-content card-glass animate-scale-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={20} color="var(--accent-primary)" />
                <h2 className="modal-title">Filter Tasks</h2>
              </div>
              <button className="btn-icon" onClick={() => setShowFilterModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-form-body">
              <div className="modal-form-scroll">
                <div className="filter-modal-grid" style={{ overflow: 'visible' }}>
                  {/* Category Filter */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Category</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                      {[
                        { id: 'all', label: 'All Categories' },
                        { id: 'Work', label: '💼 Work' },
                        { id: 'Health', label: '💪 Health' },
                        { id: 'Learning', label: '📚 Learning' },
                        { id: 'Personal', label: '🧘 Personal' }
                      ].map(chip => {
                        const isSelected = filterCategory === chip.id;
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => setFilterCategory(chip.id)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '20px',
                              fontSize: '0.80rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.18s ease-in-out',
                              background: isSelected 
                                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.35) 0%, rgba(129, 140, 248, 0.25) 100%)' 
                                : 'rgba(255, 255, 255, 0.05)',
                              color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                              border: isSelected ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.12)',
                              boxShadow: isSelected ? '0 0 12px rgba(129, 140, 248, 0.35)' : 'none',
                              transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                            }}
                          >
                            {chip.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Priority Filter */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Priority</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                      {[
                        { id: 'all', label: 'All Priorities' },
                        { id: 'High', label: '🔴 High' },
                        { id: 'Med', label: '🟡 Medium' },
                        { id: 'Low', label: '🟢 Low' }
                      ].map(chip => {
                        const isSelected = filterPriority === chip.id;
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => setFilterPriority(chip.id)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '20px',
                              fontSize: '0.80rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.18s ease-in-out',
                              background: isSelected 
                                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.35) 0%, rgba(129, 140, 248, 0.25) 100%)' 
                                : 'rgba(255, 255, 255, 0.05)',
                              color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                              border: isSelected ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.12)',
                              boxShadow: isSelected ? '0 0 12px rgba(129, 140, 248, 0.35)' : 'none',
                              transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                            }}
                          >
                            {chip.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Task Type / Status Filter */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Task Type / Status</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                      {[
                        { id: 'all', label: 'All' },
                        { id: 'pending', label: '⏳ Pending' },
                        { id: 'carriedOver', label: '🔄 Carried' },
                        { id: 'done', label: '✓ Done' },
                        { id: 'missed', label: '⚠️ Missed' },
                        { id: 'unclaimedReward', label: '🎁 Rewards' },
                        { id: 'unackPenalty', label: '⚠️ Penalties' }
                      ].map(chip => {
                        const isSelected = filterStatus === chip.id;
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => setFilterStatus(chip.id)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '20px',
                              fontSize: '0.80rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.18s ease-in-out',
                              background: isSelected 
                                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.35) 0%, rgba(129, 140, 248, 0.25) 100%)' 
                                : 'rgba(255, 255, 255, 0.05)',
                              color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                              border: isSelected ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.12)',
                              boxShadow: isSelected ? '0 0 12px rgba(129, 140, 248, 0.35)' : 'none',
                              transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                            }}
                          >
                            {chip.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rating Range Filter */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Rating Range</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                      {[
                        { id: 'all', label: 'All Ratings' },
                        { id: 'red', label: '🔴 Low (≤ 4.0)' },
                        { id: 'blue', label: '🔵 Med (4.1 – 8.5)' },
                        { id: 'green', label: '🟢 High (> 8.5)' }
                      ].map(chip => {
                        const isSelected = filterRatingRange === chip.id;
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => setFilterRatingRange(chip.id)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '20px',
                              fontSize: '0.80rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.18s ease-in-out',
                              background: isSelected 
                                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.35) 0%, rgba(129, 140, 248, 0.25) 100%)' 
                                : 'rgba(255, 255, 255, 0.05)',
                              color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                              border: isSelected ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.12)',
                              boxShadow: isSelected ? '0 0 12px rgba(129, 140, 248, 0.35)' : 'none',
                              transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                            }}
                          >
                            {chip.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="form-group" style={{ overflow: 'visible' }}>
                  <label className="form-label" style={{ fontWeight: '600' }}>Date Range Filter (Only Available Task Dates)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', overflow: 'visible' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>From Date</label>
                      <CustomDatePicker
                        currentDateStr={filterDateFrom || minAvailableDate}
                        validTaskDates={validTaskDates}
                        todayStr={todayStr}
                        onSelectDate={(newDate) => setFilterDateFrom(newDate)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>To Date</label>
                      <CustomDatePicker
                        currentDateStr={filterDateTo || todayStr}
                        validTaskDates={validTaskDates}
                        todayStr={todayStr}
                        onSelectDate={(newDate) => setFilterDateTo(newDate)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={resetAllFilters} style={{ gap: '4px' }}>
                  <RotateCcw size={14} /> Reset All
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setShowFilterModal(false)}>
                  Apply & Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {dateWarningToast && createPortal(
        <div className="responsive-toast-notification">
          <div className="toast-icon-wrapper">
            <AlertTriangle size={18} color="#fbbf24" />
          </div>
          <span style={{ flex: 1, color: '#f8fafc', fontWeight: 600 }}>{dateWarningToast}</span>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setDateWarningToast(null)}
            title="Close"
            aria-label="Close Toast"
          >
            <X size={16} />
          </button>
        </div>,
        document.body
      )}

      {showAutoCarriedBanner && autoCarriedCount > 0 && createPortal(
        <div className="responsive-toast-notification carried-over-toast">
          <div className="toast-icon-wrapper carried-toast-icon">
            <RotateCcw size={18} color="#0AFFFF" className="carried-icon-spin-subtle" />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.92rem' }}>
              Auto-Carried Over {autoCarriedCount} Task{autoCarriedCount > 1 ? 's' : ''}!
            </span>
            <span style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.78rem' }}>
              Rolled over unfinished tasks into Today's workspace.
            </span>
          </div>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => {
              setShowAutoCarriedBanner(false);
              try {
                localStorage.setItem(`dayscore_shown_carried_${todayStr}`, 'true');
              } catch (e) {}
            }}
            title="Dismiss"
            aria-label="Dismiss Notification"
          >
            <X size={16} />
          </button>
        </div>,
        document.body
      )}

      {showScrollTopBtn && createPortal(
        <button
          type="button"
          className="scroll-to-top-btn"
          onClick={scrollToTop}
          title="Scroll to Top"
          aria-label="Scroll to Top"
        >
          <ChevronUp size={20} strokeWidth={2.5} />
        </button>,
        document.body
      )}

      <ConfettiCelebration trigger={showConfetti} />
    </div>
  )
}
