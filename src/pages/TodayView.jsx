import { useState, useEffect, useCallback } from 'react'
import { format, subDays, parseISO } from 'date-fns'
import ScoreRing from '../components/ScoreRing'
import TaskCard from '../components/TaskCard'
import AddTaskModal from '../components/AddTaskModal'
import RatingSliderModal from '../components/RatingSliderModal'
import ReflectionBox from '../components/ReflectionBox'
import ConfettiCelebration from '../components/ConfettiCelebration'
import PenaltyCelebration from '../components/PenaltyCelebration'
import AuthModal from '../components/AuthModal'
import { Plus, AlertTriangle, Gift, PenLine } from 'lucide-react'
import * as store from '../store/store'
import * as scoring from '../store/scoring'
import { useDayRollover } from '../hooks/useDayRollover'
import { useNotifications } from '../hooks/useNotifications'
import { useAuth } from '../context/AuthContext'

export default function TodayView() {
  const { user } = useAuth()
  const [currentDateStr, setCurrentDateStr] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [tasks, setTasks] = useState([])
  const [reflection, setReflection] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showReflectionModal, setShowReflectionModal] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  
  const handleOpenAddModal = () => {
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

  // Load daily tasks per user & date
  useEffect(() => {
    let isMounted = true;
    const loadTasks = async () => {
      // Instant cache load
      const cached = store.getTasks(currentDateStr);
      if (cached && cached.length > 0) {
        setTasks(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // Fetch ALL user tasks directly from MongoDB Atlas
      await store.fetchAllTasksApi();
      if (!isMounted) return;

      const freshToday = store.getTasks(currentDateStr);
      setTasks(freshToday);
      setLoading(false);

      const isTaskRewardUnacknowledged = (t) => {
        if (!t.reward) return false;
        const isClaimed = t.rewardClaimed === true || t.rewardClaimed === 1 || t.reward_claimed === 1 || t.reward_claimed === '1';
        const isAck = t.rewardAcknowledged === true || t.rewardAcknowledged === 1 || t.reward_acknowledged === 1 || t.reward_acknowledged === '1';
        return !isClaimed && !isAck;
      };
      const unacknowledgedTask = freshToday.find(isTaskRewardUnacknowledged);
      setTodaysReward(unacknowledgedTask ? unacknowledgedTask.reward : null);
      
      const yesterdayStr = format(subDays(parseISO(currentDateStr), 1), 'yyyy-MM-dd');
      const yesterdayTasks = store.getTasks(yesterdayStr);
      const missed = yesterdayTasks.filter(t => t.status !== 'done' && t.status !== 'missed');
      setCarryOverTasks(missed);
      setLoading(false);
    }

    loadTasks();
    return () => { isMounted = false; }
  }, [currentDateStr, user])

  // Score, Streak & Averages Calculation effect
  useEffect(() => {
    const result = scoring.calculateDailyScore(tasks)
    setScoreResult(result)

    if (tasks.length > 0 && tasks.some(t => t.status === 'done')) {
      // Archives calculated dynamically on the fly
    }

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
    const updatedTasks = await store.addTask(currentDateStr, newTask)
    setTasks(Array.isArray(updatedTasks) ? updatedTasks : store.getTasks(currentDateStr))
    setShowAddModal(false)
  }

  const handleStatusChange = async (taskId, newStatus) => {
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
    const updatedTasks = await store.updateTask(currentDateStr, taskId, updates)
    const freshTasks = Array.isArray(updatedTasks) ? updatedTasks : store.getTasks(currentDateStr)
    setTasks(freshTasks)

    // Recalculate score
    const result = scoring.calculateDailyScore(freshTasks)
  }

  // Rating flow: open slider modal instead of directly completing
  const handleRequestComplete = (task) => {
    setRatingTask(task)
  }

  const handleRatingConfirm = async (taskId, rating, maxRating) => {
    const targetTask = tasks.find(t => t.id === taskId || t._id === taskId)
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

    const triggeredPenalty = isLowRating || isOverdue

    // Trigger Penalty if individual task rating is <= 4 OR if task was completed overdue
    if (triggeredPenalty) {
      const punishments = store.getPunishments()
      if (punishments && punishments.length > 0) {
        const randomPunishment = punishments[Math.floor(Math.random() * punishments.length)]
        taskPenalty = randomPunishment
        store.setActivePunishment(randomPunishment)
        setActivePunishment(store.getActivePunishment())
        setShowConfetti(false)
        setShowPenaltyFlash(true)
        setTimeout(() => setShowPenaltyFlash(false), 3000)
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
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
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
    const updatedTasks = await store.updateTask(currentDateStr, taskId, updates)
    const freshTasks = Array.isArray(updatedTasks) ? updatedTasks : store.getTasks(currentDateStr)
    setTasks(freshTasks)

    const result = scoring.calculateDailyScore(freshTasks)

    setRatingTask(null)
  }

  const handleRatingCancel = () => {
    setRatingTask(null)
  }

  const handleDeleteTask = async (taskId) => {
    const updatedTasks = await store.deleteTask(currentDateStr, taskId)
    const freshTasks = Array.isArray(updatedTasks) ? updatedTasks : store.getTasks(currentDateStr)
    setTasks(freshTasks)

    // Recalculate score
    const result = scoring.calculateDailyScore(freshTasks)
  }

  const handleCarryOver = (task) => {
    const newTask = { ...task, id: Date.now().toString(), carriedOver: true, status: 'pending', createdAt: new Date().toISOString() }
    store.addTask(currentDateStr, newTask)
    
    // Mark as missed in yesterday
    const yesterdayStr = format(subDays(parseISO(currentDateStr), 1), 'yyyy-MM-dd')
    store.updateTask(yesterdayStr, task.id, { status: 'missed' })
    
    setTasks(store.getTasks(currentDateStr))
    setCarryOverTasks(prev => prev.filter(t => t.id !== task.id))
  }

  const handleDismissCarryOver = (taskId) => {
    // Mark as missed in yesterday
    const yesterdayStr = format(subDays(parseISO(currentDateStr), 1), 'yyyy-MM-dd')
    store.updateTask(yesterdayStr, taskId, { status: 'missed' })
    setCarryOverTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const handleAcknowledgePunishment = async () => {
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
  }

  const handleAcknowledgeReward = async () => {
    setTodaysReward(null)

    // Mark unacknowledged task rewards for today as acknowledged in MongoDB Atlas
    const unackTasks = tasks.filter(t => {
      if (!t.reward) return false;
      const isAck = t.rewardAcknowledged === true || t.rewardAcknowledged === 1 || t.reward_acknowledged === 1 || t.reward_acknowledged === '1';
      return !isAck;
    });

    for (const t of unackTasks) {
      const targetId = t.id || t._id;
      await store.updateTask(currentDateStr, targetId, {
        rewardAcknowledged: true,
        reward_acknowledged: 1
      });
    }

    const freshTasks = await store.fetchTasksApi(currentDateStr);
    setTasks(freshTasks);
  }

  const handleClaimTaskReward = async (taskId) => {
    const target = tasks.find(t => t.id === taskId || t._id === taskId)
    const targetId = target?.id || target?._id || taskId;

    const updatedTasks = await store.updateTask(currentDateStr, targetId, {
      rewardClaimed: true,
      reward_claimed: 1,
      rewardAcknowledged: true,
      reward_acknowledged: 1,
      penaltyAccepted: false,
      penalty_accepted: 0,
      rewardClaimedAt: new Date().toISOString()
    })
    const freshTasks = Array.isArray(updatedTasks) ? updatedTasks : store.getTasks(currentDateStr)
    setTasks(freshTasks)

    setTodaysReward(null)
  }

  const handleAcceptTaskPenalty = async (taskId) => {
    const target = tasks.find(t => t.id === taskId || t._id === taskId)
    if (!target) return;

    const isAlreadyAccepted = target.penaltyAccepted === true || target.penaltyAccepted === 1 || target.penalty_accepted === 1 || target.penalty_accepted === '1';
    if (isAlreadyAccepted) return;

    const targetId = target.id || target._id;

    const updatedTasks = await store.updateTask(currentDateStr, targetId, {
      penaltyAccepted: true,
      penalty_accepted: 1,
      rewardClaimed: false,
      reward_claimed: 0,
      penaltyAcceptedAt: new Date().toISOString()
    })
    const freshTasks = Array.isArray(updatedTasks) ? updatedTasks : store.getTasks(currentDateStr)
    setTasks(freshTasks)

    store.acknowledgePunishment()
    setActivePunishment(null)
  }

  const sortTasksByUrgency = (a, b) => {
    // 1. Missed tasks ALWAYS come FIRST at the top of the list!
    const aMissed = a.status === 'missed';
    const bMissed = b.status === 'missed';
    if (aMissed !== bMissed) return aMissed ? -1 : 1;

    // 2. Completed (done) tasks ALWAYS come LAST at the bottom
    const aDone = a.status === 'done';
    const bDone = b.status === 'done';
    if (aDone !== bDone) return aDone ? 1 : -1;

    // 3. For completed tasks: show most recently completed FIRST
    if (aDone && bDone) {
      const aTime = new Date(a.completedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.completedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    }

    // 4. For active tasks (pending / inprogress): Nearest dueDateTime comes FIRST
    if (a.dueDateTime && b.dueDateTime) {
      return new Date(a.dueDateTime) - new Date(b.dueDateTime);
    }
    if (a.dueDateTime) return -1;
    if (b.dueDateTime) return 1;

    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  };

  const sortedTasks = tasks.slice().sort(sortTasksByUrgency)

  // Get punishment text safely
  const punishmentText = activePunishment && !activePunishment.acknowledged
    ? (typeof activePunishment === 'string' ? activePunishment : activePunishment.text)
    : null

  return (
    <div className="today-view">

      {carryOverTasks.length > 0 && (
        <div className="card-glass carryover-section">
          <h3 className="carryover-heading">
            <AlertTriangle size={18} /> Missed Yesterday
          </h3>
          {carryOverTasks.map(task => (
            <div key={task.id} className="carryover-item">
              <span className="carryover-task-name">{task.title}</span>
              <div className="carryover-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => handleDismissCarryOver(task.id)}>Dismiss</button>
                <button className="btn btn-primary btn-sm" onClick={() => handleCarryOver(task)}>Carry Over</button>
              </div>
            </div>
          ))}
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
          <ScoreRing 
            score={scoreResult.score} 
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
              <button className="btn btn-danger btn-sm" onClick={handleAcknowledgePunishment}>
                I Acknowledge
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
                <button className="btn btn-success btn-sm" onClick={handleAcknowledgeReward}>
                  I Accept
                </button>
              </div>
            )
          )}

          <div className="reflection-section-top" style={{ marginBottom: '24px' }}>
            <ReflectionBox value={reflection} onChange={setReflection} />
          </div>

          <div className="tasks-section">
            {sortedTasks.length === 0 ? (
              <div className="card-glass empty-state">
                <div className="empty-icon">📝</div>
                <p className="empty-text">No tasks added for today yet!</p>
                <button 
                  className="btn btn-primary"
                  onClick={handleOpenAddModal}
                >
                  <Plus size={18} /> Add Your First Task
                </button>
              </div>
            ) : (
              <div className="task-group-list">
                {sortedTasks.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onStatusChange={handleStatusChange} 
                    onDelete={handleDeleteTask}
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

      <button 
        className="fab"
        onClick={handleOpenAddModal}
        aria-label="Add Task"
      >
        <Plus size={28} />
      </button>

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
              onChange={setReflection} 
              isModal={true} 
              onClose={() => setShowReflectionModal(false)} 
            />
          </div>
        </div>
      )}

      <ConfettiCelebration trigger={showConfetti} />
    </div>
  )
}
