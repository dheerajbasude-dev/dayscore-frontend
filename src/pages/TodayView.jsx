import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, subDays, addDays, parseISO } from 'date-fns'
import ScoreRing from '../components/ScoreRing'
import TaskCard from '../components/TaskCard'
import AddTaskModal from '../components/AddTaskModal'
import RatingSliderModal from '../components/RatingSliderModal'
import ReflectionBox from '../components/ReflectionBox'
import ConfettiCelebration from '../components/ConfettiCelebration'
import PenaltyCelebration from '../components/PenaltyCelebration'
import AuthModal from '../components/AuthModal'
import { Plus, AlertTriangle, Gift, PenLine, ChevronLeft, ChevronRight, Calendar, Layers, Search, SlidersHorizontal, Filter, RotateCcw, X } from 'lucide-react'
import * as store from '../store/store'
import * as scoring from '../store/scoring'
import { useDayRollover } from '../hooks/useDayRollover'
import { useNotifications } from '../hooks/useNotifications'
import { useAuth } from '../context/AuthContext'

export default function TodayView() {
  const { user } = useAuth()
  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const [currentDateStr, setCurrentDateStr] = useState(todayStr)

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
    if (!isToday) {
      return
    }
    if (!user) {
      setShowAuthModal(true)
    } else {
      setShowAddModal(true)
    }
  }
  const [showPenaltyFlash, setShowPenaltyFlash] = useState(false)
  const [ratingTask, setRatingTask] = useState(null)

  const [archives, setArchives] = useState([])
  const [scoreResult, setScoreResult] = useState({ score: 0, baseScore: 0, bonus1: 0, bonus2: 0, penalty: 0 })
  const [streak, setStreak] = useState({ current: 0, isActive: false })
  const [averages, setAverages] = useState({ week: 0, month: 0, allTime: 0 })

  const [activePunishment, setActivePunishment] = useState(null)
  const [carryOverTasks, setCarryOverTasks] = useState([])

  const [todaysReward, setTodaysReward] = useState(null)
  const [settings, setSettings] = useState({ notifications: false })
  const [loading, setLoading] = useState(true)

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

    // Load reflection instantly from local cache then fetch synced version from MongoDB
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

      // Instant cache load
      const cached = store.getTasks(currentDateStr);
      if (cached && cached.length > 0) {
        setTasks(cached);
        const cachedUnack = cached.find(isTaskRewardUnacknowledged);
        setTodaysReward(cachedUnack ? cachedUnack.reward : null);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // Fetch ALL user tasks directly from MongoDB Atlas
      await store.fetchAllTasksApi();
      if (!isMounted) return;

      const freshToday = store.getTasks(currentDateStr);
      setTasks(freshToday);
      setArchives(store.getAllArchives());
      setLoading(false);

      const unacknowledgedTask = freshToday.find(isTaskRewardUnacknowledged);
      setTodaysReward(unacknowledgedTask ? unacknowledgedTask.reward : null);

      // Check ALL past dates for uncompleted tasks
      const allArcs = store.getAllArchives();
      const pastMissed = [];
      const seenIds = new Set();
      allArcs.forEach(arc => {
        if (arc.date && arc.date < currentDateStr && Array.isArray(arc.tasks)) {
          arc.tasks.forEach(t => {
            if (t.status !== 'done' && t.status !== 'missed') {
              const id = t.id || t._id;
              if (id && !seenIds.has(id)) {
                seenIds.add(id);
                pastMissed.push({ ...t, sourceDate: arc.date });
              }
            }
          });
        }
      });
      setCarryOverTasks(pastMissed);
      setLoading(false);
    }

    loadTasks();
    return () => { isMounted = false; }
  }, [currentDateStr, user])

  // Score, Streak & Averages Calculation effect
  useEffect(() => {
    const result = scoring.calculateDailyScore(tasks)
    setScoreResult(result)

    const updatedArchives = store.getAllArchives()
    setArchives(updatedArchives)

    const updatedStreak = scoring.getStreak(updatedArchives, tasks)
    setStreak(updatedStreak)

    setAverages({
      week: scoring.getRollingAverage(updatedArchives, 7, tasks),
      month: scoring.getRollingAverage(updatedArchives, 30, tasks),
      allTime: scoring.getRollingAverage(updatedArchives, 0, tasks)
    })
  }, [tasks, currentDateStr])

  // Auto-flag overdue tasks as missed
  useEffect(() => {
    const checkOverdue = () => {
      const now = new Date()
      let updated = false
      tasks.forEach(task => {
        if (task.status === 'pending' || task.status === 'inprogress') {
          if (task.dueDateTime && parseISO(task.dueDateTime) < now) {
            store.updateTask(currentDateStr, task.id, { status: 'missed' })
            updated = true
          }
        }
      })
      if (updated) {
        setTasks(store.getTasks(currentDateStr))
      }
    }
    checkOverdue()
    const interval = setInterval(checkOverdue, 5000)
    return () => clearInterval(interval)
  }, [tasks, currentDateStr])

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

  const handleStatusChange = async (taskOrId, newStatus) => {
    const isObject = typeof taskOrId === 'object' && taskOrId !== null;
    const taskId = isObject ? (taskOrId.id || taskOrId._id) : taskOrId;
    const taskDate = isObject ? (taskOrId.date || taskOrId.dateLabel || currentDateStr) : currentDateStr;

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
    setRatingTask(task)
  }

  const handleRatingConfirm = async (ratingTaskId, rating, maxRating) => {
    const targetTask = ratingTask || tasks.find(t => t.id === ratingTaskId || t._id === ratingTaskId)
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
        store.setActivePunishment(randomPunishment)
        setActivePunishment(store.getActivePunishment())
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

      setTodaysReward(taskReward)
      shouldTriggerReward = true
    }

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
      penalty_accepted: 0
    }
    await store.updateTask(taskDate, targetId, updates)
    await store.fetchAllTasksApi()
    setTasks(store.getTasks(currentDateStr))
    setArchives(store.getAllArchives())
    setRatingTask(null)

    // Trigger celebrations ONLY after saving completes and modal closes
    if (shouldTriggerPenalty) {
      setShowConfetti(false)
      setShowPenaltyFlash(true)
      setTimeout(() => setShowPenaltyFlash(false), 3000)
    } else if (shouldTriggerReward) {
      setShowPenaltyFlash(false)
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
    }
  }

  const handleRatingCancel = () => {
    setRatingTask(null)
  }

  const handleDeleteTask = async (taskOrId) => {
    const isObject = typeof taskOrId === 'object' && taskOrId !== null;
    const taskId = isObject ? (taskOrId.id || taskOrId._id) : taskOrId;
    const taskDate = isObject ? (taskOrId.date || taskOrId.dateLabel || currentDateStr) : currentDateStr;

    await store.deleteTask(taskDate, taskId)
    await store.fetchAllTasksApi()
    setTasks(store.getTasks(currentDateStr))
    setArchives(store.getAllArchives())
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

  const sortTasksByUrgency = (a, b) => {
    // 1. Missed tasks ALWAYS come FIRST at the top of the list!
    const aMissed = a.status === 'missed';
    const bMissed = b.status === 'missed';
    if (aMissed !== bMissed) return aMissed ? -1 : 1;

    // For missed tasks: sort by nearest past date (most recent past missed tasks FIRST, e.g. Jul 26 before Jul 25)
    if (aMissed && bMissed) {
      const dateA = new Date(a.date || a.dateLabel || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.dateLabel || b.createdAt || 0).getTime();
      return dateB - dateA;
    }

    // 2. Completed (done) tasks ALWAYS come LAST at the bottom
    const aDone = a.status === 'done';
    const bDone = b.status === 'done';
    if (aDone !== bDone) return aDone ? 1 : -1;

    // For completed tasks: show most recently completed FIRST
    if (aDone && bDone) {
      const aTime = new Date(a.completedAt || a.completed_at || a.createdAt || 0).getTime();
      const bTime = new Date(b.completedAt || b.completed_at || b.createdAt || 0).getTime();
      return bTime - aTime;
    }

    // 3. For active tasks (pending / inprogress):
    // Priority: Nearest ending task OR just added task comes FIRST!
    const dueA = a.dueDateTime || a.due_date_time;
    const dueB = b.dueDateTime || b.due_date_time;

    if (dueA && dueB) {
      return new Date(dueA).getTime() - new Date(dueB).getTime();
    }
    if (dueA) return -1;
    if (dueB) return 1;

    // If neither has due date, sort by creation date/time descending (newly added task comes FIRST!)
    const createdA = new Date(a.createdAt || a.created_at || 0).getTime();
    const createdB = new Date(b.createdAt || b.created_at || 0).getTime();
    return createdB - createdA;
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
        const catA = (a.category || 'Work').toLowerCase();
        const catB = (b.category || 'Work').toLowerCase();
        if (catA !== catB) return catA.localeCompare(catB);
      } else if (sortOption === 'created_desc') {
        const cA = new Date(a.createdAt || a.created_at || 0).getTime();
        const cB = new Date(b.createdAt || b.created_at || 0).getTime();
        if (cA !== cB) return cB - cA;
      }

      // Default sort with near-ending task privilege
      const urgencyDiff = getNearEndingUrgency(a) - getNearEndingUrgency(b);
      if (urgencyDiff !== 0) return urgencyDiff;

      return sortTasksByUrgency(a, b);
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

  // Get punishment text safely
  const punishmentText = activePunishment && !activePunishment.acknowledged
    ? (typeof activePunishment === 'string' ? activePunishment : activePunishment.text)
    : null

  const displayScore = useMemo(() => {
    if (viewMode === 'all') {
      return scoring.calculateOverallAverageTaskScore(archives, tasks);
    }
    return scoreResult.score;
  }, [viewMode, archives, tasks, scoreResult.score]);

  const displayLabel = viewMode === 'all' ? 'Total Avg Score' : 'Daily Score';

  return (
    <div className="today-view">

      {carryOverTasks.length > 0 && (
        <div className="card-glass carryover-section" style={{ padding: '14px 18px', marginBottom: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(251, 191, 36, 0.35)', background: 'rgba(251, 191, 36, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 className="carryover-heading" style={{ margin: 0, fontSize: '0.95rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} color="#fbbf24" /> Unfinished Tasks From Previous Days ({carryOverTasks.length})
            </h3>
            <button className="btn btn-primary btn-sm" onClick={handleCarryOverAll} style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
              Carry All Over
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {carryOverTasks.map(task => {
              const targetId = task.id || task._id;
              return (
                <div key={targetId} className="carryover-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-glass-light)', border: '1px solid var(--border-glass)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span className="carryover-task-name" style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{task.title}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>From {task.sourceDate} • {task.category || 'Work'}</span>
                  </div>
                  <div className="carryover-actions" style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleDismissCarryOver(task)} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>Dismiss</button>
                    <button className="btn btn-primary btn-sm" onClick={() => handleCarryOver(task)} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>Carry Over</button>
                  </div>
                </div>
              );
            })}
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
          <div className="card-glass date-nav-card" style={{ padding: '12px 18px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            {viewMode === 'date' ? (
              <div className="date-nav-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary btn-sm date-nav-btn"
                  onClick={handlePrevDay}
                  disabled={!canGoPrev}
                  title={canGoPrev ? "Previous Day with Tasks" : "No Earlier Tasks Found"}
                  style={{
                    padding: '6px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: canGoPrev ? 1 : 0.4,
                    cursor: canGoPrev ? 'pointer' : 'not-allowed'
                  }}
                >
                  <ChevronLeft size={14} /> Prev
                </button>

                <div className="date-picker-wrapper" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--bg-glass-light)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                  <Calendar size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <input
                    type="date"
                    value={currentDateStr}
                    min={minAvailableDate}
                    max={todayStr}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && val >= minAvailableDate && val <= todayStr) {
                        setCurrentDateStr(val);
                      }
                    }}
                    className="date-picker-input"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}
                  />
                </div>

                <button
                  className="btn btn-secondary btn-sm date-nav-btn"
                  onClick={handleNextDay}
                  disabled={!canGoNext}
                  title={canGoNext ? "Next Day with Tasks" : "Latest Date Reached"}
                  style={{
                    padding: '6px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: !canGoNext ? 0.4 : 1,
                    cursor: !canGoNext ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next <ChevronRight size={16} />
                </button>

                {currentDateStr !== todayStr && (
                  <button
                    className="btn btn-primary btn-sm date-nav-btn"
                    onClick={handleToday}
                    style={{ padding: '6px 12px' }}
                  >
                    Today
                  </button>
                )}
              </div>
            ) : (
              <div className="date-nav-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={16} style={{ color: 'var(--accent-primary)' }} /> All Tasks View
                </span>
              </div>
            )}

            <div className="view-mode-toggle" style={{ display: 'flex', gap: '4px', background: 'var(--bg-glass-light)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
              <button
                className={`btn btn-sm ${viewMode === 'date' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleSetViewMode('date')}
                style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Calendar size={14} /> Date View ({tasks.length})
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleSetViewMode('all')}
                style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Layers size={14} /> All Tasks ({allTasksAcrossDates.length})
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

          <div className="reflection-section-top" style={{ marginBottom: '24px' }}>
            <ReflectionBox 
              value={reflection} 
              onChange={(val) => {
                setReflection(val);
                store.saveReflection(currentDateStr, val);
              }} 
            />
          </div>

          {/* Filter, Sort & Search Control Bar */}
          <div className="card-glass task-controls-card">
            {/* Search Input Row, Inline Sort & Advanced Filter Button */}
            <div className="task-search-row">
              <div className="task-search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  className="task-search-input"
                  placeholder="Search tasks by title..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" className="task-search-clear" onClick={() => setSearchQuery('')}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Inline Sort Selection */}
              <select
                className="task-sort-inline-select"
                value={sortOption}
                onChange={e => setSortOption(e.target.value)}
                title="Sort Tasks"
              >
                <option value="default">⏰ Sort: Near Due (Default)</option>
                <option value="urgency">⏰ Sort: Due Time Urgency</option>
                <option value="rating_desc">★ Sort: Highest Rating</option>
                <option value="rating_asc">★ Sort: Lowest Rating</option>
                <option value="title_asc">🔤 Sort: Title (A-Z)</option>
                <option value="category">📁 Sort: Category</option>
                <option value="created_desc">🆕 Sort: Newly Created</option>
              </select>

              <button
                type="button"
                className={`btn btn-secondary btn-sm ${activeFilterCount > 0 ? 'active' : ''}`}
                onClick={() => setShowFilterModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', padding: '8px 14px' }}
              >
                <SlidersHorizontal size={15} />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="badge badge-pri" style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '10px' }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
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
                    onStatusChange={(taskId, newStatus) => handleStatusChange(taskId, newStatus)}
                    onDelete={(taskId) => handleDeleteTask(taskId)}
                    onRequestComplete={handleRequestComplete}
                    onClaimReward={handleClaimTaskReward}
                    onAcceptPenalty={handleAcceptTaskPenalty}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {isToday && (
        <button
          className="fab"
          onClick={handleOpenAddModal}
          aria-label="Add Task"
        >
          <Plus size={28} />
        </button>
      )}

      {showAddModal && (
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
          <div className="modal-content card-glass animate-scale-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px', width: '92%' }}>
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

      {/* Advanced Filter & Sort Modal */}
      {showFilterModal && (
        <div className="modal-overlay" onClick={() => setShowFilterModal(false)}>
          <div className="modal-content card-glass animate-scale-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', width: '92%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SlidersHorizontal size={20} color="var(--accent-primary)" />
                <h2 className="modal-title">Filter & Sort Tasks</h2>
              </div>
              <button className="btn-icon" onClick={() => setShowFilterModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
              {/* Sort Selection */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '700' }}>Sort By (Near Ending Task Privileged)</label>
                <select
                  className="select"
                  value={sortOption}
                  onChange={e => setSortOption(e.target.value)}
                >
                  <option value="default">⏰ Default (Near Ending Task Privilege + Sequence)</option>
                  <option value="urgency">⏰ Due Time / Urgency (Near Ending First)</option>
                  <option value="rating_desc">★ Highest Rating First (★ 10 → ★ 0)</option>
                  <option value="rating_asc">★ Lowest Rating First (★ 0 → ★ 10)</option>
                  <option value="title_asc">🔤 Title (A to Z)</option>
                  <option value="category">📁 Category (Work / Learning / Health / Personal)</option>
                  <option value="created_desc">🆕 Newly Created First</option>
                </select>
              </div>

              <div className="filter-modal-grid">
                {/* Category Filter */}
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                    <option value="all">All Categories</option>
                    <option value="Work">Work</option>
                    <option value="Learning">Learning</option>
                    <option value="Health">Health</option>
                    <option value="Personal">Personal</option>
                  </select>
                </div>

                {/* Priority Filter */}
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                    <option value="all">All Priorities</option>
                    <option value="High">High</option>
                    <option value="Med">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                {/* Status & Special Type Filter */}
                <div className="form-group">
                  <label className="form-label">Task Type / Status</label>
                  <select className="select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="all">All Task Types</option>
                    <option value="pending">Pending Tasks</option>
                    <option value="done">Completed Tasks</option>
                    <option value="missed">Missed Tasks</option>
                    <option value="carriedOver">Carried Over Tasks</option>
                    <option value="reward">Tasks with Reward</option>
                    <option value="penalty">Tasks with Penalty</option>
                    <option value="unclaimedReward">🎁 Unclaimed Rewards</option>
                    <option value="unackPenalty">⚠️ Unacknowledged Penalties</option>
                  </select>
                </div>

                {/* Rating Range Filter */}
                <div className="form-group">
                  <label className="form-label">Rating Range</label>
                  <select className="select" value={filterRatingRange} onChange={e => setFilterRatingRange(e.target.value)}>
                    <option value="all">All Ratings</option>
                    <option value="red">🔴 Red Threshold (≤ 4.0)</option>
                    <option value="blue">🔵 Blue Threshold (4.1 – 8.5)</option>
                    <option value="green">🟢 Green Threshold (&gt; 8.5)</option>
                    <option value="" disabled>── Specific Rating Values ──</option>
                    {Array.from({ length: 21 }).map((_, i) => {
                      const val = (i * 0.5).toFixed(1);
                      return <option key={val} value={val}>Rating: ★ {val}</option>;
                    })}
                  </select>
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="form-group">
                <label className="form-label">Date Range Filter</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="date"
                    className="input"
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                    placeholder="From Date"
                    style={{ fontSize: '0.85rem' }}
                  />
                  <input
                    type="date"
                    className="input"
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                    placeholder="To Date"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

      <ConfettiCelebration trigger={showConfetti} />
    </div>
  )
}
