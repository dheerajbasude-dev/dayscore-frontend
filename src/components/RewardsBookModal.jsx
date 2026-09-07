import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { getLocalDateStr } from '../utils/taskUtils';
import ConfettiCelebration from './ConfettiCelebration';

export default function RewardsBookModal({
  isOpen,
  onClose,
  onTaskUpdated,
  onNavigateToTask,
  initialTab = 'all',
  activeTasks = []
}) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(initialTab && initialTab !== 'history' ? initialTab : 'all');
  const [searchQuery, setSearchQuery] = useState('');

  // Track whether initial data has loaded at least once
  const hasInitialLoadedRef = useRef(false);

  // Lazy initialize all data from local storage/cache so modal displays instantly with 0ms delay
  const [allTasks, setAllTasks] = useState(() => {
    try {
      return store.getAllTasksFlat() || [];
    } catch (e) {
      return [];
    }
  });
  const [milestones, setMilestones] = useState(() => {
    try {
      return store.getStreakMilestoneRewards() || {};
    } catch (e) {
      return {};
    }
  });
  const [claimedMilestones, setClaimedMilestones] = useState(() => {
    try {
      return store.getClaimedStreakMilestones() || {};
    } catch (e) {
      return {};
    }
  });
  const [effectiveStreak, setEffectiveStreak] = useState(0);
  const [activePunishment, setActivePunishment] = useState(() => {
    try {
      return store.getActivePunishment() || null;
    } catch (e) {
      return null;
    }
  });

  // Only show blocking loader on the very first mount if local storage has 0 tasks
  const [loading, setLoading] = useState(() => {
    try {
      const initial = store.getAllTasksFlat();
      return !initial || initial.length === 0;
    } catch (e) {
      return false;
    }
  });

  const [refreshKey, setRefreshKey] = useState(0);

  // Operation loading state trackers
  const [claimingId, setClaimingId] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const formatDateSafe = (isoStr) => {
    if (!isoStr) return null;
    try {
      const d = typeof isoStr === 'string' ? parseISO(isoStr) : new Date(isoStr);
      if (isNaN(d.getTime())) return null;
      return format(d, 'MMM dd, h:mm a');
    } catch (e) {
      return null;
    }
  };

  const formatHeaderDate = (dateVal) => {
    if (!dateVal) return '';
    if (typeof dateVal === 'string' && dateVal.startsWith('Streak')) return dateVal;
    try {
      const d = typeof dateVal === 'string' ? parseISO(dateVal) : new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return format(d, 'MMM dd, yyyy · h:mm a');
    } catch (e) {
      return String(dateVal);
    }
  };

  const formatRatingDisplay = (val) => {
    if (val == null || val === '' || isNaN(Number(val))) return '';
    const num = Number(val);
    return Number.isInteger(num) ? `${num}` : `${num.toFixed(1)}`;
  };

  const getRatingBadgeClass = (r) => {
    if (r == null) return '';
    if (r >= 8) return 'rating-badge-high';
    if (r >= 5) return 'rating-badge-mid';
    return 'rating-badge-low';
  };

  const handleTaskClick = (item) => {
    if (!item.task) return;
    const taskDate = getLocalDateStr(item.taskDate || item.task.date || item.task.completedAt || item.task.dueDateTime) || format(new Date(), 'yyyy-MM-dd');
    if (onNavigateToTask) {
      onNavigateToTask(item.task, taskDate);
    }
    onClose();
  };

  // Manage body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      const safeTab = (initialTab && initialTab !== 'history') ? initialTab : 'all';
      setActiveTab(safeTab);
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

  // Instant data hydration & background revalidation (never flash loading screen on re-opening)
  useEffect(() => {
    if (!isOpen) return;

    // 1. Immediately populate from local cache so newly added items show up instantly with 0ms delay
    const flat = store.getAllTasksFlat() || [];
    const mergedList = [...flat];
    if (Array.isArray(activeTasks) && activeTasks.length > 0) {
      const seenIds = new Set();
      const seenFps = new Set();
      flat.forEach(t => {
        if (t.id) seenIds.add(String(t.id));
        if (t._id) seenIds.add(String(t._id));
        const fp = `${(t.title || '').trim().toLowerCase()}_${(t.dueDateTime || t.due_date_time || '').substring(0, 16)}_${(t.completedAt || t.completed_at || '').substring(0, 16)}`;
        seenFps.add(fp);
      });

      activeTasks.forEach(at => {
        const tid = String(at.id || at._id || '');
        const fp = `${(at.title || '').trim().toLowerCase()}_${(at.dueDateTime || at.due_date_time || '').substring(0, 16)}_${(at.completedAt || at.completed_at || '').substring(0, 16)}`;
        if (tid && seenIds.has(tid)) return;
        if (fp && seenFps.has(fp)) return;
        if (tid) seenIds.add(tid);
        if (fp) seenFps.add(fp);
        mergedList.push(at);
      });
    }

    setAllTasks(mergedList);
    setMilestones(store.getStreakMilestoneRewards() || {});
    setClaimedMilestones(store.getClaimedStreakMilestones() || {});
    setActivePunishment(store.getActivePunishment());

    try {
      const archives = store.getAllArchives();
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todayTasks = store.getTasks(todayStr);
      const currentStreakObj = scoring.getStreak(archives, todayTasks);
      const bestStreak = scoring.getBestStreak(archives, todayTasks);
      setEffectiveStreak(Math.max(currentStreakObj.current || 0, bestStreak || 0));
    } catch (e) {}

    // If we have cached data or have loaded before, DO NOT show full loading spinner!
    if (hasInitialLoadedRef.current || mergedList.length > 0) {
      setLoading(false);
    } else {
      setLoading(true);
    }

    // 2. Silent background sync (stale-while-revalidate): update with server data seamlessly
    let isCancelled = false;
    Promise.all([
      store.fetchAllTasksApi().catch(() => {}),
      store.fetchStreakMilestonesApi().catch(() => {})
    ]).then(() => {
      if (isCancelled) return;
      hasInitialLoadedRef.current = true;
      setLoading(false);
      const updatedFlat = store.getAllTasksFlat() || [];
      const updatedMerged = [...updatedFlat];
      if (Array.isArray(activeTasks) && activeTasks.length > 0) {
        const seenIds = new Set();
        const seenFps = new Set();
        updatedFlat.forEach(t => {
          if (t.id) seenIds.add(String(t.id));
          if (t._id) seenIds.add(String(t._id));
          const fp = `${(t.title || '').trim().toLowerCase()}_${(t.dueDateTime || t.due_date_time || '').substring(0, 16)}_${(t.completedAt || t.completed_at || '').substring(0, 16)}`;
          seenFps.add(fp);
        });

        activeTasks.forEach(at => {
          const tid = String(at.id || at._id || '');
          const fp = `${(at.title || '').trim().toLowerCase()}_${(at.dueDateTime || at.due_date_time || '').substring(0, 16)}_${(at.completedAt || at.completed_at || '').substring(0, 16)}`;
          if (tid && seenIds.has(tid)) return;
          if (fp && seenFps.has(fp)) return;
          if (tid) seenIds.add(tid);
          if (fp) seenFps.add(fp);
          updatedMerged.push(at);
        });
      }
      setAllTasks(updatedMerged);
      const mData = store.getStreakMilestoneRewards();
      const cData = store.getClaimedStreakMilestones();
      setMilestones(mData || {});
      setClaimedMilestones(cData || {});
      setActivePunishment(store.getActivePunishment());
    }).catch(() => {
      if (isCancelled) return;
      setLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, activeTasks, refreshKey]);

  // Build the complete ledger items list with strict deduplication
  const ledgerItems = useMemo(() => {
    const items = [];
    const seenRewardIds = new Set();
    const seenRewardFps = new Set();
    const seenPenaltyIds = new Set();
    const seenPenaltyFps = new Set();

    // 1. Task-based Rewards & Penalties
    allTasks.forEach(task => {
      const rawId = task.id || task._id;
      const taskId = rawId ? String(rawId) : null;
      const cleanTaskDate = getLocalDateStr(task.date || task.taskDate || task.originalDate || task.dueDateTime || task.due_date_time) || format(new Date(), 'yyyy-MM-dd');
      const isDone = task.status === 'done' || task.completed === true;
      const isMissed = task.status === 'missed' || task.missed === true;
      const ratingNum = task.rating != null && !isNaN(Number(task.rating)) ? Number(task.rating) : null;

      // Only completed or missed tasks have settled rewards or penalties!
      // Incomplete/in-progress tasks are excluded from the book ledger.
      if (!isDone && !isMissed) {
        return;
      }

      const taskTitleClean = (task.title || '').trim().toLowerCase();
      const taskDue = (task.dueDateTime || task.due_date_time || '').substring(0, 16);
      const taskComp = (task.completedAt || task.completed_at || '').substring(0, 16);

      // 1. Has reward?
      // A reward exists only if task is completed AND (rating > 4.0 or unrated) AND has a reward defined
      const isRewardClaimed = Boolean(
        task.rewardClaimed === true || task.rewardClaimed === 1 || task.rewardClaimed === '1' ||
        task.reward_claimed === true || task.reward_claimed === 1 || task.reward_claimed === '1' ||
        task.rewardAcknowledged === true || task.rewardAcknowledged === 1 || task.rewardAcknowledged === '1' ||
        task.reward_acknowledged === true || task.reward_acknowledged === 1 || task.reward_acknowledged === '1' ||
        Boolean(task.rewardClaimedAt || task.reward_claimed_at) ||
        (task.id && localStorage.getItem(`dayscore_reward_ack_${task.id}`) === '1') ||
        (task._id && localStorage.getItem(`dayscore_reward_ack_${task._id}`) === '1')
      );
      const hasHighRatingReward = isDone && (ratingNum == null || ratingNum > 4.0);
      const isHighRatingTask = isDone && ratingNum != null && ratingNum >= 9;
      const rewardText = (task.reward && task.reward.trim()) || (isHighRatingTask ? "Treat yourself for high score!" : null);

      if (isDone && hasHighRatingReward && rewardText) {
        const rewardKey = taskId ? `reward_${taskId}` : null;
        const rewardFp = `reward_fp_${taskTitleClean}_${(rewardText).toLowerCase()}_${taskDue}_${taskComp}`;

        const isDuplicate = (rewardKey && seenRewardIds.has(rewardKey)) || seenRewardFps.has(rewardFp);
        if (!isDuplicate) {
          if (rewardKey) seenRewardIds.add(rewardKey);
          seenRewardFps.add(rewardFp);

          items.push({
            id: rewardKey || `reward_item_${items.length}_${Date.now()}`,
            rawId: taskId || rewardFp,
            type: 'reward',
            text: rewardText,
            task,
            taskDate: cleanTaskDate,
            isCompleted: true,
            isClaimed: isRewardClaimed,
            status: isRewardClaimed ? 'claimed' : 'pending',
            date: task.completedAt || task.completed_at || cleanTaskDate,
            rating: ratingNum
          });
        }
      }

      // 2. Has penalty?
      // A penalty exists if task is missed, OR if completed with low rating (<= 4.0)
      const isPenaltyAccepted = Boolean(
        task.penaltyAccepted === true || task.penaltyAccepted === 1 || task.penaltyAccepted === '1' ||
        task.penalty_accepted === true || task.penalty_accepted === 1 || task.penalty_accepted === '1' ||
        task.penaltyAcknowledged === true || task.penaltyAcknowledged === 1 || task.penaltyAcknowledged === '1' ||
        task.penalty_acknowledged === true || task.penalty_acknowledged === 1 || task.penalty_acknowledged === '1' ||
        Boolean(task.penaltyAcceptedAt || task.penalty_accepted_at) ||
        (task.id && localStorage.getItem(`dayscore_penalty_ack_${task.id}`) === '1') ||
        (task._id && localStorage.getItem(`dayscore_penalty_ack_${task._id}`) === '1')
      );
      const hasLowRatingPenalty = isDone && ratingNum != null && ratingNum <= 4.0;

      if (isMissed || hasLowRatingPenalty) {
        const penaltyText = task.penalty && task.penalty.trim() ? task.penalty : "Complete 15-min focus reflection / workout";
        const penaltyKey = taskId ? `penalty_${taskId}` : null;
        const penaltyFp = `penalty_fp_${taskTitleClean}_${(penaltyText).toLowerCase()}_${taskDue}_${taskComp}`;

        const isDuplicate = (penaltyKey && seenPenaltyIds.has(penaltyKey)) || seenPenaltyFps.has(penaltyFp);
        if (!isDuplicate) {
          if (penaltyKey) seenPenaltyIds.add(penaltyKey);
          seenPenaltyFps.add(penaltyFp);

          items.push({
            id: penaltyKey || `penalty_item_${items.length}_${Date.now()}`,
            rawId: taskId || penaltyFp,
            type: 'penalty',
            text: penaltyText,
            task,
            taskDate: cleanTaskDate,
            isCompleted: isDone,
            isClaimed: isPenaltyAccepted,
            status: isPenaltyAccepted ? 'acknowledged' : 'pending',
            date: task.dueDateTime || task.due_date_time || cleanTaskDate,
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

        const updatePayload = {
          rewardClaimed: true,
          reward_claimed: 1,
          rewardAcknowledged: true,
          reward_acknowledged: 1,
          rewardClaimedAt: new Date().toISOString()
        };
        if (item.text) {
          updatePayload.reward = item.text;
        }

        const updatePromise = store.updateTask(targetDate, targetId, updatePayload);
        const timerPromise = new Promise(r => setTimeout(r, 450));
        await Promise.all([updatePromise, timerPromise]);

        try {
          if (targetId) localStorage.setItem(`dayscore_reward_ack_${targetId}`, '1');
          if (item.task.id) localStorage.setItem(`dayscore_reward_ack_${item.task.id}`, '1');
          if (item.task._id) localStorage.setItem(`dayscore_reward_ack_${item.task._id}`, '1');
        } catch (e) {}

        // Immediately update local allTasks state
        setAllTasks(prev => prev.map(t => {
          const tid = t.id || t._id;
          if (String(tid) === String(targetId)) {
            return {
              ...t,
              rewardClaimed: true,
              reward_claimed: 1,
              rewardAcknowledged: true,
              reward_acknowledged: 1,
              rewardClaimedAt: new Date().toISOString()
            };
          }
          return t;
        }));
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

        const updatePromise = store.updateTask(targetDate, targetId, {
          penaltyAccepted: true,
          penalty_accepted: 1,
          penaltyAcknowledged: true,
          penalty_acknowledged: 1,
          penaltyAcceptedAt: new Date().toISOString()
        });
        const timerPromise = new Promise(r => setTimeout(r, 450));
        await Promise.all([updatePromise, timerPromise]);

        try {
          if (targetId) localStorage.setItem(`dayscore_penalty_ack_${targetId}`, '1');
          if (item.task.id) localStorage.setItem(`dayscore_penalty_ack_${item.task.id}`, '1');
          if (item.task._id) localStorage.setItem(`dayscore_penalty_ack_${item.task._id}`, '1');
        } catch (e) {}

        // Immediately update local allTasks state
        setAllTasks(prev => prev.map(t => {
          const tid = t.id || t._id;
          if (String(tid) === String(targetId)) {
            return {
              ...t,
              penaltyAccepted: true,
              penalty_accepted: 1,
              penaltyAcknowledged: true,
              penalty_acknowledged: 1,
              penaltyAcceptedAt: new Date().toISOString()
            };
          }
          return t;
        }));
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
                {activeTab === 'penalties' ? '🛡️' : '🎉'}
              </div>
              <h3 className="empty-title">
                {searchQuery 
                  ? 'No matching ledger items found' 
                  : (activeTab === 'penalties' 
                      ? 'No pending penalties! You are in good standing' 
                      : (activeTab === 'rewards' 
                          ? 'No pending rewards right now' 
                          : 'All caught up! No pending items to claim or acknowledge.'))}
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
                        {/* Heading: Directly REWARD : <text> or PENALTY : <text> */}
                        <div className="rewards-book-item-title-row">
                          <span className={`item-type-prefix ${isPenalty ? 'prefix-penalty' : (isMilestone ? 'prefix-milestone' : 'prefix-reward')}`}>
                            {isPenalty ? '⚠️ PENALTY :' : (isMilestone ? '🔥 MILESTONE :' : '🎁 REWARD :')}
                          </span>
                          <span className="rewards-book-item-title-text">
                            {item.text}
                          </span>
                        </div>

                        {/* Associated Task Information matching TaskCard UI */}
                        {hasTask && (() => {
                          const createdFormatted = formatDateSafe(item.task.createdAt || item.task.created_at || item.task.originalDate || item.task.original_date);
                          const dueFormatted = formatDateSafe(item.task.dueDateTime || item.task.due_date_time);
                          const completedFormatted = formatDateSafe(item.task.completedAt || item.task.completed_at);
                          const taskRating = item.rating != null ? Number(item.rating) : (item.task.rating != null ? Number(item.task.rating) : null);
                          const isTaskMissed = item.task.status === 'missed' || item.task.missed === true;

                          return (
                            <div 
                              className="rewards-book-task-pill rewards-book-task-pill--clickable"
                              onClick={() => handleTaskClick(item)}
                              title={`Click to view task on ${item.taskDate || 'date'}`}
                            >
                              <div className="task-pill-info task-meta-row" style={{ margin: 0, padding: 0 }}>
                                <span className="task-pill-label" style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Task:</span>
                                {Boolean(item.task.carriedOver || item.task.carried_over || item.task.wasCarried || item.task.isCarried) && (
                                  <span className="carried-over-blinking-badge" title="Carried over task" style={{ width: '16px', height: '16px', margin: '0 2px' }}>
                                    <RotateCcw size={10} className="carried-icon-spin-subtle" />
                                  </span>
                                )}
                                <strong className="task-pill-title" style={{ color: 'var(--text-primary)' }}>
                                  {item.task.title}
                                </strong>
                                
                                {item.task.category && (
                                  <span className={`badge badge-${item.task.category.toLowerCase()}`}>
                                    {item.task.category}
                                  </span>
                                )}

                                {item.task.priority && (
                                  <>
                                    <span className="meta-dot">·</span>
                                    <span className={`priority-text priority-${item.task.priority.toLowerCase()}`}>
                                      {item.task.priority}
                                    </span>
                                  </>
                                )}

                                {taskRating != null && (
                                  <>
                                    <span className="meta-dot">·</span>
                                    <span className={`rating-badge ${getRatingBadgeClass(taskRating)}`}>
                                      ★ {formatRatingDisplay(taskRating)}/10
                                    </span>
                                  </>
                                )}

                                {(createdFormatted || dueFormatted) && (
                                  <>
                                    <span className="meta-dot">·</span>
                                    <span className="task-dates-inline">
                                      {createdFormatted ? <span>{createdFormatted}</span> : <span>{item.taskDate || 'Today'}</span>}
                                      {dueFormatted && (
                                        <>
                                          <span className="dates-arrow">→</span>
                                          <span className={isTaskMissed ? 'task-date-missed' : 'task-date-due'}>
                                            {dueFormatted}
                                          </span>
                                        </>
                                      )}
                                    </span>
                                  </>
                                )}

                                {completedFormatted && (
                                  <>
                                    <span className="meta-dot">·</span>
                                    <span className="task-date-completed">
                                      ✓ {completedFormatted}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Milestone info row if no task */}
                        {!hasTask && item.date && (
                          <div className="rewards-book-task-pill">
                            <span className="item-date-text">
                              <Calendar size={12} /> {formatHeaderDate(item.date)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Claim or Acknowledge Action Button */}
                    <div className="rewards-book-item-actions">
                      {isPenalty ? (
                        (isClaimed || item.status === 'acknowledged') && acceptingId !== item.id ? (
                          <button className="btn btn-sm btn-secondary acknowledged rewards-action-pill" disabled>
                            ✓ Acknowledged
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`btn btn-sm btn-secondary rewards-action-pill ${acceptingId === item.id ? 'is-loading' : ''}`}
                            onClick={() => handleAcceptPenalty(item)}
                            disabled={acceptingId === item.id}
                          >
                            {acceptingId === item.id ? (
                              <>
                                <Loader2 size={13} className="btn-spinner" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              'Acknowledge'
                            )}
                          </button>
                        )
                      ) : (
                        isClaimed && claimingId !== item.id ? (
                          <button className="btn btn-sm btn-success claimed rewards-action-pill" disabled>
                            ✓ Claimed
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`btn btn-sm btn-success rewards-action-pill ${claimingId === item.id ? 'is-loading' : ''}`}
                            onClick={() => handleClaimReward(item)}
                            disabled={claimingId === item.id}
                          >
                            {claimingId === item.id ? (
                              <>
                                <Loader2 size={13} className="btn-spinner" />
                                <span>Claiming...</span>
                              </>
                            ) : (
                              'Claim'
                            )}
                          </button>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
