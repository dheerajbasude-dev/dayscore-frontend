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

  // Initialize data per user & date
  useEffect(() => {
    let isMounted = true;
    const loadUserData = async () => {
      const allArchives = await store.fetchArchivesApi()
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
    }

    loadUserData()
    return () => { isMounted = false; }
  }, [currentDateStr, user])

  // Load daily tasks & reflection per user & date
  useEffect(() => {
    let isMounted = true;
    const loadTasks = async () => {
      const todayTasks = await store.fetchTasksApi(currentDateStr)
      if (!isMounted) return;
      setTasks(todayTasks)
      
      const dayArchive = store.getDayArchive(currentDateStr)
      setReflection(dayArchive ? dayArchive.reflection || '' : '')

      const taskWithReward = todayTasks.find(t => t.reward)
      const existingReward = dayArchive?.reward || taskWithReward?.reward || null
      const isAcknowledged = dayArchive?.rewardAcknowledged || false

      setTodaysReward(existingReward && !isAcknowledged ? existingReward : null)
      
      const yesterdayStr = format(subDays(parseISO(currentDateStr), 1), 'yyyy-MM-dd')
      const yesterdayTasks = await store.fetchTasksApi(yesterdayStr)
      if (!isMounted) return;
      const missed = yesterdayTasks.filter(t => t.status !== 'done' && t.status !== 'missed')
      setCarryOverTasks(missed)
    }

    loadTasks()
    return () => { isMounted = false; }
  }, [currentDateStr, user])

  // Score, Streak & Averages Calculation effect
  useEffect(() => {
    const result = scoring.calculateDailyScore(tasks)
    setScoreResult(result)

    if (tasks.length > 0 && tasks.some(t => t.status === 'done')) {
      const existing = store.getDayArchive(currentDateStr) || {}
      store.saveDayArchive(currentDateStr, {
        ...existing,
        date: currentDateStr,
        score: result.score,
        tasks
      })
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
      const existing = store.getDayArchive(currentDateStr) || {}
      store.saveDayArchive(currentDateStr, {
        ...existing,
        date: currentDateStr,
        score: result.score,
        tasks: currentTasks
      })

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

  const handleAddTask = (newTask) => {
    store.addTask(currentDateStr, newTask)
    setTasks(store.getTasks(currentDateStr))
    setShowAddModal(false)
  }

  const handleStatusChange = (taskId, newStatus) => {
    const updates = { status: newStatus }
    if (newStatus === 'done') {
      updates.completedAt = new Date().toISOString()
    } else if (newStatus === 'pending') {
      updates.completedAt = null
      updates.rating = null
      updates.reward = null
      updates.penalty = null
      updates.rewardClaimed = false
      updates.penaltyAccepted = false
    }
    store.updateTask(currentDateStr, taskId, updates)
    setTasks(store.getTasks(currentDateStr))
  }

  // Rating flow: open slider modal instead of directly completing
  const handleRequestComplete = (task) => {
    setRatingTask(task)
  }

  const handleRatingConfirm = (taskId, rating, maxRating) => {
    const targetTask = tasks.find(t => t.id === taskId)
    const now = new Date()
    const isOverdue = targetTask?.dueDateTime && parseISO(targetTask.dueDateTime) < now

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
      rating,
      maxRating,
      reward: taskReward,
      penalty: taskPenalty
    }
    store.updateTask(currentDateStr, taskId, updates)
    const updatedTasks = store.getTasks(currentDateStr)
    setTasks(updatedTasks)

    const result = scoring.calculateDailyScore(updatedTasks)
    const existing = store.getDayArchive(currentDateStr) || {}
    const finalDayReward = taskReward || existing.reward || null
    const rewardAcknowledgedStatus = taskReward ? false : (existing.rewardAcknowledged || false)

    store.saveDayArchive(currentDateStr, {
      ...existing,
      date: currentDateStr,
      score: result.score,
      tasks: updatedTasks,
      reward: finalDayReward,
      rewardAcknowledged: rewardAcknowledgedStatus
    })

    setRatingTask(null)
  }

  const handleRatingCancel = () => {
    setRatingTask(null)
  }

  const handleDeleteTask = (taskId) => {
    store.deleteTask(currentDateStr, taskId)
    setTasks(store.getTasks(currentDateStr))
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

  const handleAcknowledgePunishment = () => {
    if (punishmentText) {
      store.logClaim({
        type: 'penalty',
        text: punishmentText,
        date: currentDateStr
      })
    }
    store.acknowledgePunishment()
    setActivePunishment(null)
  }

  const handleAcknowledgeReward = () => {
    if (todaysReward) {
      store.logClaim({
        type: 'reward',
        text: todaysReward,
        date: currentDateStr
      })
    }
    setTodaysReward(null)
    const existing = store.getDayArchive(currentDateStr) || {}
    store.saveDayArchive(currentDateStr, {
      ...existing,
      rewardAcknowledged: true,
      reward: null
    })
  }

  const handleClaimTaskReward = (taskId) => {
    const target = tasks.find(t => t.id === taskId)
    store.updateTask(currentDateStr, taskId, {
      rewardClaimed: true,
      rewardClaimedAt: new Date().toISOString()
    })
    const updated = store.getTasks(currentDateStr)
    setTasks(updated)

    if (target && target.reward) {
      store.logClaim({
        type: 'reward',
        text: target.reward,
        date: currentDateStr
      })
    }
    setTodaysReward(null)
    const existing = store.getDayArchive(currentDateStr) || {}
    store.saveDayArchive(currentDateStr, {
      ...existing,
      rewardAcknowledged: true,
      reward: null,
      tasks: updated
    })
  }

  const handleAcceptTaskPenalty = (taskId) => {
    const target = tasks.find(t => t.id === taskId)
    store.updateTask(currentDateStr, taskId, {
      penaltyAccepted: true,
      penaltyAcceptedAt: new Date().toISOString()
    })
    const updated = store.getTasks(currentDateStr)
    setTasks(updated)

    if (target && target.penalty) {
      store.logClaim({
        type: 'penalty',
        text: target.penalty,
        date: currentDateStr
      })
    }
    store.acknowledgePunishment()
    setActivePunishment(null)
    const existing = store.getDayArchive(currentDateStr) || {}
    store.saveDayArchive(currentDateStr, {
      ...existing,
      tasks: updated
    })
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
