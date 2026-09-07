import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Gift, 
  AlertOctagon, 
  BookOpen, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Sparkles, 
  Trophy, 
  Calendar, 
  ArrowRight, 
  Check, 
  Loader2, 
  Search, 
  ShieldAlert, 
  Flame, 
  RotateCcw,
  CheckCheck,
  Star
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import * as store from '../store/store';
import * as scoring from '../store/scoring';
import { useToast } from '../context/ToastContext';
import ConfettiCelebration from './ConfettiCelebration';

export default function RewardsBookModal({
  isOpen,
  onClose,
  onTaskUpdated,
  initialTab = 'all'
}) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Operation loading state trackers
  const [claimingId, setClaimingId] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Local state for tasks and milestones
  const [allTasks, setAllTasks] = useState([]);
  const [milestones, setMilestones] = useState({});
  const [claimedMilestones, setClaimedMilestones] = useState({});
  const [effectiveStreak, setEffectiveStreak] = useState(0);
  const [activePunishment, setActivePunishment] = useState(null);

  // Manage body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      setActiveTab(initialTab || 'all');
      setSearchQuery('');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isOpen, initialTab]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load fresh data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // First load from local storage
      const flat = store.getAllTasksFlat();
      setAllTasks(flat);
      setMilestones(store.getStreakMilestoneRewards() || {});
      setClaimedMilestones(store.getClaimedStreakMilestones() || {});
      setActivePunishment(store.getActivePunishment());

      const archives = store.getAllArchives();
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todayTasks = store.getTasks(todayStr);
      const currentStreakObj = scoring.getStreak(archives, todayTasks);
      const bestStreak = scoring.getBestStreak(archives, todayTasks);
      setEffectiveStreak(Math.max(currentStreakObj.current || 0, bestStreak || 0));

      // Fetch fresh from backend
      await Promise.all([
        store.fetchAllTasksApi().catch(() => {}),
        store.fetchStreakMilestonesApi().catch(() => {})
      ]);

      const updatedFlat = store.getAllTasksFlat();
      setAllTasks(updatedFlat);
      const mData = store.getStreakMilestoneRewards();
      const cData = store.getClaimedStreakMilestones();
      setMilestones(mData || {});
      setClaimedMilestones(cData || {});
      setActivePunishment(store.getActivePunishment());
    } catch (err) {
      console.error('Error loading rewards book data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData, refreshKey]);

  // Build the complete ledger items list
  const ledgerItems = useMemo(() => {
    const items = [];
    const seenTaskKeys = new Set();

    // 1. Task-based Rewards & Penalties
    allTasks.forEach(task => {
      const taskId = task.id || task._id;
      const taskDate = task.date || task.taskDate || task.originalDate || format(new Date(), 'yyyy-MM-dd');
      const isDone = task.status === 'done' || task.completed === true;
      const isMissed = task.status === 'missed' || task.missed === true;
      const ratingNum = task.rating != null && !isNaN(Number(task.rating)) ? Number(task.rating) : null;

      // Has reward?
      const isRewardClaimed = Boolean(
        task.rewardClaimed === true || task.rewardClaimed === 1 || task.rewardClaimed === '1' ||
        task.reward_claimed === true || task.reward_claimed === 1 || task.reward_claimed === '1'
      );
      const hasHighRatingReward = isDone && (ratingNum == null || ratingNum > 4.0);
      const hasExplicitReward = Boolean(task.reward && task.reward.trim());

      if (hasExplicitReward || (isDone && hasHighRatingReward && task.reward)) {
        const key = `reward_${taskId}`;
        if (!seenTaskKeys.has(key)) {
          seenTaskKeys.add(key);
          items.push({
            id: key,
            rawId: taskId,
            type: 'reward',
            text: task.reward,
            task,
            taskDate,
            isCompleted: isDone,
            isClaimed: isRewardClaimed,
            status: isRewardClaimed ? 'claimed' : 'pending',
            date: task.completedAt || task.completed_at || taskDate,
            rating: ratingNum
          });
        }
      }

      // Has penalty?
      const isPenaltyAccepted = Boolean(
        task.penaltyAccepted === true || task.penaltyAccepted === 1 || task.penaltyAccepted === '1' ||
        task.penalty_accepted === true || task.penalty_accepted === 1 || task.penalty_accepted === '1'
      );
      const hasLowRatingPenalty = (isDone || isMissed) && (ratingNum != null && ratingNum <= 4.0);
      const hasExplicitPenalty = Boolean(task.penalty && task.penalty.trim());

      if (hasExplicitPenalty || hasLowRatingPenalty || isMissed) {
        const penaltyText = task.penalty || "15-min focus reflection / penalty workout";
        const key = `penalty_${taskId}`;
        if (!seenTaskKeys.has(key)) {
          seenTaskKeys.add(key);
          items.push({
            id: key,
            rawId: taskId,
            type: 'penalty',
            text: penaltyText,
            task,
            taskDate,
            isCompleted: isDone,
            isClaimed: isPenaltyAccepted,
            status: isPenaltyAccepted ? 'acknowledged' : 'pending',
            date: task.dueDateTime || task.due_date_time || taskDate,
            rating: ratingNum
          });
        }
      }
    });

    // 2. Streak Milestone Rewards (7, 14, 30, 100 days)
    const milestoneDays = [7, 14, 30, 100];
    milestoneDays.forEach(days => {
      const rewardText = milestones[days];
      if (rewardText && rewardText.trim()) {
        const isUnlocked = effectiveStreak >= days;
        const isClaimed = Boolean(claimedMilestones[days]);
        items.push({
          id: `milestone_${days}`,
          rawId: days,
          type: 'milestone',
          days,
          text: rewardText,
          isUnlocked,
          isClaimed,
          status: isClaimed ? 'claimed' : (isUnlocked ? 'pending' : 'locked'),
          date: `Streak Milestone: ${days} Days`
        });
      }
    });

    return items;
  }, [allTasks, milestones, claimedMilestones, effectiveStreak]);

  // Aggregate Metrics & Progress Calculations
  const stats = useMemo(() => {
    const rewards = ledgerItems.filter(i => i.type === 'reward' || (i.type === 'milestone' && i.isUnlocked));
    const penalties = ledgerItems.filter(i => i.type === 'penalty');

    const totalRewards = rewards.length;
    const claimedRewards = rewards.filter(i => i.isClaimed).length;
    const pendingRewards = rewards.filter(i => !i.isClaimed);

    const totalPenalties = penalties.length;
    const acknowledgedPenalties = penalties.filter(i => i.isClaimed).length;
    const pendingPenalties = penalties.filter(i => !i.isClaimed);

    // Tasks that are linked to pending actions and not yet completed
    const pendingTasks = ledgerItems.filter(i => i.task && !i.isCompleted && !i.isClaimed);

    const rewardsProgress = totalRewards > 0 ? Math.round((claimedRewards / totalRewards) * 100) : 100;
    const penaltiesProgress = totalPenalties > 0 ? Math.round((acknowledgedPenalties / totalPenalties) * 100) : 100;

    const totalActions = totalRewards + totalPenalties;
    const clearedActions = claimedRewards + acknowledgedPenalties;
    const disciplineScore = totalActions > 0 ? Math.round((clearedActions / totalActions) * 100) : 100;

    const pendingTotal = pendingRewards.length + pendingPenalties.length;

    return {
      totalRewards,
      claimedRewards,
      pendingRewardsCount: pendingRewards.length,
      rewardsProgress,
      totalPenalties,
      acknowledgedPenalties,
      pendingPenaltiesCount: pendingPenalties.length,
      penaltiesProgress,
      disciplineScore,
      pendingTotal,
      pendingTasksCount: pendingTasks.length,
      historyCount: clearedActions
    };
  }, [ledgerItems]);

  // Filter items based on active tab and search query
  const filteredItems = useMemo(() => {
    let list = [];

    if (activeTab === 'all') {
      list = ledgerItems.filter(i => i.status === 'pending');
    } else if (activeTab === 'rewards') {
      list = ledgerItems.filter(i => (i.type === 'reward' || i.type === 'milestone') && i.status === 'pending');
    } else if (activeTab === 'penalties') {
      list = ledgerItems.filter(i => i.type === 'penalty' && i.status === 'pending');
    } else if (activeTab === 'tasks') {
      list = ledgerItems.filter(i => i.task && !i.isCompleted);
    } else if (activeTab === 'history') {
      list = ledgerItems.filter(i => i.status === 'claimed' || i.status === 'acknowledged');
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(item => {
        const textMatch = item.text && item.text.toLowerCase().includes(query);
        const taskTitleMatch = item.task && item.task.title && item.task.title.toLowerCase().includes(query);
        const dateMatch = item.date && String(item.date).toLowerCase().includes(query);
        return textMatch || taskTitleMatch || dateMatch;
      });
    }

    return list;
  }, [ledgerItems, activeTab, searchQuery]);

  // Claim a Reward (Task or Milestone)
  const handleClaimReward = async (item) => {
    if (claimingId) return;
    setClaimingId(item.id);
    try {
      if (item.type === 'milestone') {
        const updated = await store.claimStreakMilestoneApi(item.days);
        setClaimedMilestones({ ...updated });
      } else if (item.task) {
        const targetId = item.task.id || item.task._id;
        const targetDate = item.taskDate || format(new Date(), 'yyyy-MM-dd');
        await store.updateTask(targetDate, targetId, {
          rewardClaimed: true,
          reward_claimed: 1,
          rewardAcknowledged: true,
          reward_acknowledged: 1,
          rewardClaimedAt: new Date().toISOString()
        });
      }

      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      showToast(`🎉 Reward Claimed: "${item.text}"`, 'success');
      setRefreshKey(k => k + 1);
      onTaskUpdated?.();
    } catch (err) {
      console.error('Error claiming reward:', err);
      showToast("Couldn't claim reward. Please check your connection.", 'error');
    } finally {
      setClaimingId(null);
    }
  };

  // Acknowledge / Accept a Penalty
  const handleAcceptPenalty = async (item) => {
    if (acceptingId) return;
    setAcceptingId(item.id);
    try {
      if (item.task) {
        const targetId = item.task.id || item.task._id;
        const targetDate = item.taskDate || format(new Date(), 'yyyy-MM-dd');
        await store.updateTask(targetDate, targetId, {
          penaltyAccepted: true,
          penalty_accepted: 1,
          penaltyAcceptedAt: new Date().toISOString()
        });
      }

      store.acknowledgePunishment();
      showToast(`✓ Penalty Acknowledged: "${item.text}"`, 'success');
      setRefreshKey(k => k + 1);
      onTaskUpdated?.();
    } catch (err) {
      console.error('Error accepting penalty:', err);
      showToast("Couldn't acknowledge penalty. Please try again.", 'error');
    } finally {
      setAcceptingId(null);
    }
  };

  // Complete a Task directly from inside the Book list
  const handleCompleteTask = async (item) => {
    if (completingId || !item.task) return;
    const targetId = item.task.id || item.task._id;
    const targetDate = item.taskDate || format(new Date(), 'yyyy-MM-dd');
    setCompletingId(item.id);
    try {
      const nowIso = new Date().toISOString();
      const updates = {
        status: 'done',
        completed: true,
        completedAt: nowIso,
        completed_at: nowIso
      };

      // If completing task without a reward, randomly pick one from rewards pool
      if (!item.task.reward) {
        const rewardsPool = store.getRewards();
        if (rewardsPool && rewardsPool.length > 0) {
          updates.reward = rewardsPool[Math.floor(Math.random() * rewardsPool.length)];
        }
      }

      await store.updateTask(targetDate, targetId, updates);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      showToast(`Task "${item.task.title || 'Task'}" completed!`, 'success');
      setRefreshKey(k => k + 1);
      onTaskUpdated?.();
    } catch (err) {
      console.error('Error completing task in book:', err);
      showToast("Couldn't complete task. Please try again.", 'error');
    } finally {
      setCompletingId(null);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="rewards-book-modal-backdrop animate-fade-in" onClick={onClose}>
      <div 
        className="rewards-book-modal-content card-glass animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <ConfettiCelebration trigger={showConfetti} />

        {/* Modal Header */}
        <div className="rewards-book-header">
          <div className="rewards-book-title-group">
            <div className="rewards-book-icon-badge">
              <BookOpen size={24} />
            </div>
            <div>
              <h2 className="rewards-book-title">
                Rewards & Penalties Book
                {stats.pendingTotal > 0 && (
                  <span className="rewards-book-counter-pill">
                    {stats.pendingTotal} Pending
                  </span>
                )}
              </h2>
              <p className="rewards-book-subtitle">
                Acknowledge, claim, and check off pending rewards and penalties ledger
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-icon rewards-book-close-btn" 
            onClick={onClose}
            aria-label="Close Rewards Book"
          >
            <X size={20} />
          </button>
        </div>

        {/* Hero Progress & Discipline Overview Card */}
        <div className="rewards-book-progress-card">
          <div className="rewards-book-progress-grid">
            
            {/* Rewards Progress */}
            <div className="rewards-progress-col">
              <div className="progress-col-header">
                <span className="progress-col-label">
                  <Gift size={15} style={{ color: 'var(--accent-success)' }} />
                  <strong>Rewards Claimed</strong>
                </span>
                <span className="progress-col-val" style={{ color: 'var(--accent-success)' }}>
                  {stats.claimedRewards} / {stats.totalRewards} ({stats.rewardsProgress}%)
                </span>
              </div>
              <div className="progress-bar-track">
                <div 
                  className="progress-bar-fill progress-bar-fill--reward" 
                  style={{ width: `${stats.rewardsProgress}%` }}
                />
              </div>
            </div>

            {/* Penalties Progress */}
            <div className="rewards-progress-col">
              <div className="progress-col-header">
                <span className="progress-col-label">
                  <AlertOctagon size={15} style={{ color: 'var(--accent-danger)' }} />
                  <strong>Penalties Acknowledged</strong>
                </span>
                <span className="progress-col-val" style={{ color: 'var(--accent-danger)' }}>
                  {stats.acknowledgedPenalties} / {stats.totalPenalties} ({stats.penaltiesProgress}%)
                </span>
              </div>
              <div className="progress-bar-track">
                <div 
                  className="progress-bar-fill progress-bar-fill--penalty" 
                  style={{ width: `${stats.penaltiesProgress}%` }}
                />
              </div>
            </div>

            {/* Overall Discipline Score */}
            <div className="rewards-discipline-badge">
              <div className="discipline-val">
                <Trophy size={16} />
                <span>{stats.disciplineScore}%</span>
              </div>
              <span className="discipline-label">Resolution Rate</span>
            </div>

          </div>
        </div>

        {/* Search Bar & Tab Navigation */}
        <div className="rewards-book-toolbar">
          <div className="rewards-book-tabs">
            <button
              type="button"
              className={`rewards-book-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <span>⚡ All Pending</span>
              {stats.pendingTotal > 0 && (
                <span className="tab-count-badge tab-count-badge--alert">{stats.pendingTotal}</span>
              )}
            </button>

            <button
              type="button"
              className={`rewards-book-tab ${activeTab === 'rewards' ? 'active' : ''}`}
              onClick={() => setActiveTab('rewards')}
            >
              <span>🎁 Rewards</span>
              {stats.pendingRewardsCount > 0 && (
                <span className="tab-count-badge tab-count-badge--success">{stats.pendingRewardsCount}</span>
              )}
            </button>

            <button
              type="button"
              className={`rewards-book-tab ${activeTab === 'penalties' ? 'active' : ''}`}
              onClick={() => setActiveTab('penalties')}
            >
              <span>⚠️ Penalties</span>
              {stats.pendingPenaltiesCount > 0 && (
                <span className="tab-count-badge tab-count-badge--danger">{stats.pendingPenaltiesCount}</span>
              )}
            </button>

            <button
              type="button"
              className={`rewards-book-tab ${activeTab === 'tasks' ? 'active' : ''}`}
              onClick={() => setActiveTab('tasks')}
            >
              <span>⏳ Tasks</span>
              {stats.pendingTasksCount > 0 && (
                <span className="tab-count-badge">{stats.pendingTasksCount}</span>
              )}
            </button>

            <button
              type="button"
              className={`rewards-book-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <span>📜 History</span>
              {stats.historyCount > 0 && (
                <span className="tab-count-badge">{stats.historyCount}</span>
              )}
            </button>
          </div>

          <div className="rewards-book-search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Search rewards, penalties, tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rewards-book-search-input"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="btn-icon" 
                style={{ padding: '2px' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* List Section */}
        <div className="rewards-book-list-container">
          {loading ? (
            <div className="rewards-book-loading">
              <Loader2 size={32} className="btn-spinner" style={{ color: 'var(--accent-primary)' }} />
              <span>Loading ledger data...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rewards-book-empty">
              <div className="empty-icon">
                {activeTab === 'history' ? '📜' : (activeTab === 'penalties' ? '🛡️' : '🎉')}
              </div>
              <h3 className="empty-title">
                {searchQuery 
                  ? 'No matching ledger items found' 
                  : (activeTab === 'history' 
                      ? 'No claimed history yet' 
                      : (activeTab === 'penalties' 
                          ? 'No pending penalties! You are in good standing' 
                          : (activeTab === 'rewards' 
                              ? 'No pending rewards right now' 
                              : 'All caught up! No pending items to claim or acknowledge.')))}
              </h3>
              <p className="empty-desc">
                {activeTab === 'rewards' 
                  ? 'Rate tasks 10/10 or reach streak milestones to earn new rewards.' 
                  : (activeTab === 'penalties' 
                      ? 'Great discipline! Keep completing tasks on time to avoid penalties.' 
                      : 'Keep completing tasks with high ratings to unlock and track more rewards.')}
              </p>
            </div>
          ) : (
            <ul className="rewards-book-items-list">
              {filteredItems.map((item, idx) => {
                const isReward = item.type === 'reward';
                const isMilestone = item.type === 'milestone';
                const isPenalty = item.type === 'penalty';
                const isClaimed = item.isClaimed;
                const isTaskDone = item.isCompleted;
                const hasTask = Boolean(item.task);

                return (
                  <li 
                    key={item.id} 
                    className={`rewards-book-item animate-slide-up ${isClaimed ? 'is-claimed' : ''} ${isPenalty ? 'rewards-book-item--penalty' : ''}`}
                    style={{ animationDelay: `${Math.min(idx * 0.03, 0.3)}s` }}
                  >
                    {/* Left: Index Badge + Main Content */}
                    <div className="rewards-book-item-left">
                      {/* Index Badge */}
                      <span className={`rewards-index-badge ${isPenalty ? 'rewards-index-badge--penalty' : (isMilestone ? 'rewards-index-badge--milestone' : '')}`}>
                        #{idx + 1}
                      </span>

                      {/* Content Details */}
                      <div className="rewards-book-item-details">
                        <div className="rewards-book-item-header">
                          <span className={`item-type-badge ${isPenalty ? 'badge-danger' : (isMilestone ? 'badge-milestone' : 'badge-success')}`}>
                            {isPenalty ? '⚠️ Penalty' : (isMilestone ? `🔥 ${item.days}-Day Milestone` : '🎁 Reward')}
                          </span>

                          {item.rating != null && (
                            <span className="item-rating-badge">
                              <Star size={11} /> {Number(item.rating).toFixed(1)}/10
                            </span>
                          )}

                          {item.date && (
                            <span className="item-date-text">
                              <Calendar size={12} /> {item.date}
                            </span>
                          )}
                        </div>

                        {/* Reward / Penalty Text */}
                        <div className="rewards-book-item-text">
                          {item.text}
                        </div>

                        {/* Associated Task Information */}
                        {hasTask && (
                          <div className="rewards-book-task-pill">
                            <div className="task-pill-info">
                              <span className="task-pill-label">Task:</span>
                              <strong className="task-pill-title">{item.task.title}</strong>
                              {item.task.category && (
                                <span className="task-category-pill">{item.task.category}</span>
                              )}
                            </div>

                            {/* Direct In-List Task Completion Action */}
                            {!isTaskDone ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary task-pill-complete-btn"
                                onClick={() => handleCompleteTask(item)}
                                disabled={completingId === item.id}
                                title="Complete this task now to verify and unlock claim"
                              >
                                {completingId === item.id ? (
                                  <>
                                    <Loader2 size={13} className="btn-spinner" />
                                    <span>Completing...</span>
                                  </>
                                ) : (
                                  <>
                                    <Circle size={13} />
                                    <span>Mark Task Done</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="task-pill-status task-pill-status--done">
                                <CheckCheck size={13} /> Completed
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Claim or Acknowledge Action Button */}
                    <div className="rewards-book-item-actions">
                      {isClaimed ? (
                        <div className="rewards-claimed-status">
                          <CheckCircle2 size={16} />
                          <span>{isPenalty ? 'Acknowledged' : 'Claimed'}</span>
                        </div>
                      ) : isReward || isMilestone ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-success rewards-claim-action-btn"
                          onClick={() => handleClaimReward(item)}
                          disabled={claimingId === item.id}
                        >
                          {claimingId === item.id ? (
                            <>
                              <Loader2 size={14} className="btn-spinner" />
                              <span>Claiming...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} />
                              <span>Claim Reward 🎉</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger rewards-claim-action-btn"
                          onClick={() => handleAcceptPenalty(item)}
                          disabled={acceptingId === item.id}
                        >
                          {acceptingId === item.id ? (
                            <>
                              <Loader2 size={14} className="btn-spinner" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Check size={14} />
                              <span>Acknowledge ✓</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer info bar */}
        <div className="rewards-book-footer">
          <span className="rewards-book-footer-note">
            💡 Checking off or claiming rewards immediately syncs to your account and updates your daily score.
          </span>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Close Book
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
