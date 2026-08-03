import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { format, subDays, addDays, parseISO } from 'date-fns'
import ScoreRing from '../components/ScoreRing'
import TaskCard from '../components/TaskCard'
import AddTaskModal from '../components/AddTaskModal'
import RatingSliderModal from '../components/RatingSliderModal'
import MissedTasksModal from '../components/MissedTasksModal'
import CustomDatePicker from '../components/CustomDatePicker'
import CustomSelect from '../components/CustomSelect'
import ReflectionBox from '../components/ReflectionBox'
import ConfettiCelebration from '../components/ConfettiCelebration'
import PenaltyCelebration from '../components/PenaltyCelebration'
import AuthModal from '../components/AuthModal'
import { Plus, AlertTriangle, Gift, PenLine, ChevronLeft, ChevronRight, Calendar, Layers, Search, SlidersHorizontal, Filter, RotateCcw, X, Clock, Zap, Check, ChevronUp } from 'lucide-react'
import * as store from '../store/store'
import * as scoring from '../store/scoring'
import { useDayRollover } from '../hooks/useDayRollover'
import { useNotifications } from '../hooks/useNotifications'
import { useAuth } from '../context/AuthContext'

export default function TodayView() {
  const { user } = useAuth()
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const [currentDateStr, setCurrentDateStr] = useState(() => {
    try {
      const uid = store.getUserId()
      const saved = localStorage.getItem(`dayscore_${uid}_selected_date`)
      if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
        return saved
      }
    } catch (e) {}
    return format(new Date(), 'yyyy-MM-dd')
  })

  useEffect(() => {
    try {
      const uid = store.getUserId()
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

  // Filter, Sort & Search States
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState('default') // default, pending, carriedOver, missed, completed, reward, penalty, rating_red, rating_blue, rating_green, category
  const [filterCategory, setFilterCategory] = useState('all') // all, Work, Learning, Health, Personal
  const [filterPriority, setFilterPriority] = useState('all') // all, High, Med, Low
  const [filterStatus, setFilterStatus] = useState('all') // all, pending, done, missed, carriedOver, reward, penalty, unclaimedReward, unackPenalty
  const [filterRatingRange, setFilterRatingRange] = useState('all') // all, red, blue, green, or rating number string
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [showFilterModal, setShowFilterModal] = useState(false)

  const resetAllFilters = () => {
    setSearchQuery('')
    setSortOption('default')
    setFilterCategory('all')
    setFilterPriority('all')
    setFilterStatus('all')
    setFilterRatingRange('all')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

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

  // --- Scroll Position Persistence across Refresh ---
  const hasRestoredScrollRef = useRef(false);

  useEffect(() => {
    const handleSaveScroll = () => {
      const currentY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      if (currentY > 0) {
        sessionStorage.setItem('dayscore_today_scroll_pos', currentY.toString());
      }
    };

    window.addEventListener('beforeunload', handleSaveScroll);
    window.addEventListener('pagehide', handleSaveScroll);

    let scrollTimeout;
    const onScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleSaveScroll, 150);
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('beforeunload', handleSaveScroll);
      window.removeEventListener('pagehide', handleSaveScroll);
      window.removeEventListener('scroll', onScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const checkScrollTop = () => {
      const currentY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      setShowScrollTop(currentY > 250);
    };

    window.addEventListener('scroll', checkScrollTop, { passive: true });
    return () => window.removeEventListener('scroll', checkScrollTop);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    sessionStorage.setItem('dayscore_today_scroll_pos', '0');
  };

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

  const [isMissedModalOpen, setIsMissedModalOpen] = useState(false)

  const pastUnfinishedTasks = useMemo(() => {
    const list = [];
    const allArcs = archives.length > 0 ? archives : store.getArchivesFromTasks();
    allArcs.forEach(arc => {
      if (arc.date && arc.date < todayStr && Array.isArray(arc.tasks)) {
        arc.tasks.forEach(t => {
          if (t.status === 'pending' || t.status === 'inprogress') {
            list.push({ ...t, taskDate: arc.date });
          }
        });
      }
    });
    return list;
  }, [archives, todayStr]);

  const handleCarryOverMissedTask = async (task) => {
    const originDate = task.taskDate || task.date || task.dateLabel;
    const taskId = task.id || task._id;
    await store.updateTask(originDate, taskId, {
      date: todayStr,
      carriedOver: true,
      carried_over: 1,
      originalDate: originDate,
      original_date: originDate,
      reward: null,
      penalty: null,
      rewardClaimed: false,
      reward_claimed: 0,
      penaltyAccepted: false,
      penalty_accepted: 0
    });
    await store.fetchAllTasksApi();
    setTasks(store.getTasks(currentDateStr));
    setArchives(store.getArchivesFromTasks());
  };

  const handleCompleteMissedTask = async (task) => {
    const originDate = task.taskDate || task.date || task.dateLabel;
    const taskId = task.id || task._id;
    await store.updateTask(originDate, taskId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      completed_at: new Date().toISOString()
    });
    await store.fetchAllTasksApi();
    setTasks(store.getTasks(currentDateStr));
    setArchives(store.getArchivesFromTasks());
  };

  const handleDeleteMissedTask = async (task) => {
    const originDate = task.taskDate || task.date || task.dateLabel;
    const taskId = task.id || task._id;
    await store.deleteTask(originDate, taskId);
    await store.fetchAllTasksApi();
    setTasks(store.getTasks(currentDateStr));
    setArchives(store.getArchivesFromTasks());
  };

  const handleCarryOverAllMissedTasks = async () => {
    for (const t of pastUnfinishedTasks) {
      const originDate = t.taskDate || t.date || t.dateLabel;
      const taskId = t.id || t._id;
      await store.updateTask(originDate, taskId, {
        date: todayStr,
        carriedOver: true,
        carried_over: 1,
        originalDate: originDate,
        original_date: originDate,
        reward: null,
        penalty: null,
        rewardClaimed: false,
        reward_claimed: 0,
        penaltyAccepted: false,
        penalty_accepted: 0
      });
    }
    await store.fetchAllTasksApi();
    setTasks(store.getTasks(currentDateStr));
    setArchives(store.getArchivesFromTasks());
  };

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

  // Compute all tasks across all dates from archives
  const allTasksAcrossDates = useMemo(() => {
    const list = []
    const seenIds = new Set()
    const allArcs = archives.length > 0 ? archives : store.getAllArchives()
    allArcs.forEach(arc => {
      if (Array.isArray(arc.tasks)) {
        arc.tasks.forEach(t => {
          const id = t.id || t._id
          if (id && !seenIds.has(id)) {
            seenIds.add(id)
            list.push({ ...t, dateLabel: arc.date })
          } else if (!id) {
            list.push({ ...t, dateLabel: arc.date })
          }
        })
      }
    })
    return list
  }, [archives])

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
        store.fetchRewardsApi()
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
          if (task.status === 'pending' || task.status === 'inprogress') {
            const due = task.dueDateTime || task.due_date_time;
            if (due) {
              const dueDateObj = new Date(due);
              const targetDueDateStr = format(dueDateObj, 'yyyy-MM-dd');

              if (targetDueDateStr > arc.date && targetDueDateStr <= todayStr && dueDateObj >= now) {
                await store.updateTask(arc.date, task.id || task._id, { date: targetDueDateStr });
                updated = true;
              } else if (dueDateObj < now) {
                await store.updateTask(arc.date, task.id || task._id, { status: 'missed' });
                updated = true;
              }
            } else if (arc.date < todayStr) {
              await store.updateTask(arc.date, task.id || task._id, { status: 'missed' });
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
    // ALWAYS create new tasks for TODAY's date (todayStr) as requested by user
    await store.addTask(todayStr, newTask)
    await store.fetchAllTasksApi()
    setTasks(store.getTasks(currentDateStr))
    setArchives(store.getAllArchives())
    setShowAddModal(false)
  }

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

    await store.updateTask(taskDate, targetId, {
      daily_notes: updatedNotes,
      dailyNotes: updatedNotes
    });

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

  // Rating flow: open slider modal instead of directly completing
  const handleRequestComplete = (task) => {
    if (!task) return;
    if (task.status === 'missed' && currentDateStr < todayStr) return;
    setRatingTask(task)
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

    const isCarriedOver = Boolean(
      targetTask?.carriedOver ||
      targetTask?.carried_over ||
      targetTask?.originalDate ||
      targetTask?.original_date
    );

    // Carried over missed tasks do NOT trigger rewards or penalties
    if (isCarriedOver) {
      taskReward = null;
      taskPenalty = null;
      shouldTriggerPenalty = false;
      shouldTriggerReward = false;
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
    // Tier 1: 🔴 Missed Tasks (status: 'missed')
    // Tier 2: ⏩ Carried-over Tasks (carriedOver, carried_over, originalDate, original_date)
    // Tier 3: ⏳ Pending / Active Tasks (status: 'pending' / 'inprogress')
    // Tier 4: 🟢 Completed Tasks (status: 'done') with pending claim / acknowledge
    // Tier 5: 🟢 Completed Tasks (status: 'done')
    const getStatusTier = (t) => {
      // Tier 1: Missed Tasks
      if (t.status === 'missed') return 1;

      const isCarried = Boolean(t.carriedOver || t.carried_over || t.originalDate || t.original_date || t.wasCarried || t.isCarried);

      // Tier 2: Carried-over Tasks (uncompleted)
      if (t.status !== 'done' && isCarried) return 2;

      // Tier 3: Pending / Active Tasks (uncompleted)
      if (t.status !== 'done') return 3;

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

      // Tier 4: Completed Tasks with pending claim / acknowledge
      if (hasUnclaimedReward || hasUnacknowledgedPenalty) {
        return 4;
      }

      // Tier 5: Completed Tasks (fully claimed/acknowledged or no reward/penalty)
      return 5;
    };

    const tierA = getStatusTier(a);
    const tierB = getStatusTier(b);

    if (tierA !== tierB) {
      return tierA - tierB;
    }

    // Within each tier: Sort by nearest date with time FIRST (ascending order)
    const getTaskTimestamp = (t) => {
      const dueStr = t.dueDateTime || t.due_date_time;
      if (dueStr) {
        const ms = new Date(dueStr).getTime();
        if (!isNaN(ms)) return ms;
      }
      const isoStr = t.completedAt || t.completed_at || t.updatedAt || t.updated_at || t.createdAt || t.created_at || t.date || t.originalDate || t.original_date;
      if (!isoStr) return 9999999999999;
      const ms = new Date(isoStr).getTime();
      return isNaN(ms) ? 9999999999999 : ms;
    };

    const timeA = getTaskTimestamp(a);
    const timeB = getTaskTimestamp(b);
    return timeA - timeB; // Nearest date with time FIRST
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
        list = list.filter(t => Boolean(t.carriedOver || t.carried_over));
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
    if (displayTasksList.length > 0 && !hasRestoredScrollRef.current) {
      const savedPos = sessionStorage.getItem('dayscore_today_scroll_pos');
      if (savedPos != null) {
        const targetScroll = parseInt(savedPos, 10);
        if (!isNaN(targetScroll) && targetScroll > 0) {
          hasRestoredScrollRef.current = true;
          requestAnimationFrame(() => {
            setTimeout(() => {
              window.scrollTo({ top: targetScroll, behavior: 'instant' });
            }, 100);
          });
        }
      }
    }
  }, [displayTasksList]);

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

      {/* Notification Banner for Unfinished / Missed Days */}
      {showPastPendingBanner && pastUnfinishedTasks.length > 0 && (
        <div className="card-glass animate-slide-up" style={{
          padding: '16px 20px',
          marginBottom: '20px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          boxShadow: '0 8px 24px rgba(245, 158, 11, 0.12)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.18)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Clock size={20} color="#f59e0b" />
            </div>
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Pending & Missed Tasks From Previous Days
                <span style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(245, 158, 11, 0.25)',
                  color: '#fbbf24',
                  fontWeight: 600
                }}>
                  {pastUnfinishedTasks.length} {pastUnfinishedTasks.length === 1 ? 'Task' : 'Tasks'}
                </span>
              </strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                Recorded across {pastUnfinishedDates.length} {pastUnfinishedDates.length === 1 ? 'day' : 'days'} ({pastUnfinishedDates.join(', ')}). Resolve or bring them to today.
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={() => setIsMissedModalOpen(true)}
              style={{
                fontSize: '0.82rem',
                padding: '7px 14px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                color: '#fff',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Zap size={14} />
              Manage Missed Tasks
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCarryOverAllMissedTasks}
              style={{ fontSize: '0.82rem', padding: '7px 12px' }}
              title="Bring all missed tasks to today instantly"
            >
              Carry Over All
            </button>
            <button
              className="btn-icon"
              onClick={() => {
                setShowPastPendingBanner(false);
                try {
                  sessionStorage.setItem(`dayscore_dismiss_pending_${todayStr}`, 'true');
                } catch (e) {}
              }}
              title="Dismiss Banner"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

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
                  <span>Tasks: <strong>{displayTasksList.length}</strong></span>
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
                  {displayTasksList.filter(t => Boolean(t.carriedOver || t.carried_over || t.originalDate || t.original_date)).length > 0 && (
                    <span className="task-stat-chip chip-carried" title="Carried Over Tasks">
                      <RotateCcw size={12} /> <strong>{displayTasksList.filter(t => Boolean(t.carriedOver || t.carried_over || t.originalDate || t.original_date)).length}</strong> Carried
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
                  style={{ width: 'auto', minWidth: '135px' }}
                />

                <button
                  type="button"
                  className={`btn btn-secondary btn-sm ${activeFilterCount > 0 ? 'active' : ''}`}
                  onClick={() => setShowFilterModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', padding: '6px 12px', height: '36px', fontSize: '0.82rem' }}
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

      {showReflectionModal && (
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
        </div>
      )}

      {/* Advanced Filter Modal */}
      {showFilterModal && (
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
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <CustomSelect
                      value={filterCategory}
                      onChange={val => setFilterCategory(val)}
                      options={[
                        { label: 'All Categories', value: 'all' },
                        { label: 'Work', value: 'Work' },
                        { label: 'Learning', value: 'Learning' },
                        { label: 'Health', value: 'Health' },
                        { label: 'Personal', value: 'Personal' }
                      ]}
                    />
                  </div>

                  {/* Priority Filter */}
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <CustomSelect
                      value={filterPriority}
                      onChange={val => setFilterPriority(val)}
                      options={[
                        { label: 'All Priorities', value: 'all' },
                        { label: 'High', value: 'High' },
                        { label: 'Medium', value: 'Med' },
                        { label: 'Low', value: 'Low' }
                      ]}
                    />
                  </div>

                  {/* Status & Special Type Filter */}
                  <div className="form-group">
                    <label className="form-label">Task Type / Status</label>
                    <CustomSelect
                      value={filterStatus}
                      onChange={val => setFilterStatus(val)}
                      options={[
                        { label: 'All Task Types', value: 'all' },
                        { label: 'Pending Tasks', value: 'pending' },
                        { label: 'Completed Tasks', value: 'done' },
                        { label: 'Missed Tasks', value: 'missed' },
                        { label: 'Tasks with Reward', value: 'reward' },
                        { label: 'Tasks with Penalty', value: 'penalty' },
                        { label: '🎁 Unclaimed Rewards', value: 'unclaimedReward' },
                        { label: '⚠️ Unacknowledged Penalties', value: 'unackPenalty' }
                      ]}
                    />
                  </div>

                  {/* Rating Range Filter */}
                  <div className="form-group">
                    <label className="form-label">Rating Range</label>
                    <CustomSelect
                      value={filterRatingRange}
                      onChange={val => setFilterRatingRange(val)}
                      options={[
                        { label: 'All Ratings', value: 'all' },
                        { label: '🔴 Red Threshold (≤ 4.0)', value: 'red' },
                        { label: '🔵 Blue Threshold (4.1 – 8.5)', value: 'blue' },
                        { label: '🟢 Green Threshold (> 8.5)', value: 'green' },
                        { label: '── Specific Rating Values ──', value: '', disabled: true },
                        ...Array.from({ length: 21 }).map((_, i) => {
                          const val = (i * 0.5).toFixed(1);
                          return { label: `Rating: ★ ${val}`, value: val };
                        })
                      ]}
                    />
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
        </div>
      )}

      <MissedTasksModal
        isOpen={isMissedModalOpen}
        onClose={() => setIsMissedModalOpen(false)}
        pastUnfinishedTasks={pastUnfinishedTasks}
        onCarryOverTask={handleCarryOverMissedTask}
        onCompleteTask={handleCompleteMissedTask}
        onDeleteTask={handleDeleteMissedTask}
        onCarryOverAll={handleCarryOverAllMissedTasks}
        onJumpToDate={(d) => setCurrentDateStr(d)}
      />

      {dateWarningToast && (
        <div className="animate-fade-in" style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 999999,
          background: 'rgba(239, 68, 68, 0.95)',
          color: '#fff',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <AlertTriangle size={16} color="#fff" />
          {dateWarningToast}
        </div>
      )}

      <ConfettiCelebration trigger={showConfetti} />

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="scroll-to-top-center-btn"
          title="Scroll to Top"
          aria-label="Scroll to Top"
        >
          <ChevronUp size={18} strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}
