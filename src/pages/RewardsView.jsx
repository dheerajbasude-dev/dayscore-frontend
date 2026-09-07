import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Check, Gift, AlertOctagon, Info, History, Trophy, Sparkles, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import * as store from '../store/store'
import * as scoring from '../store/scoring'
import { useAuth } from '../context/AuthContext'

export default function RewardsView() {
  const { user } = useAuth()
  const [rewards, setRewards] = useState(() => store.getRewards())
  const [punishments, setPunishments] = useState(() => store.getPunishments())
  const [milestones, setMilestones] = useState(() => store.getStreakMilestoneRewards() || {})
  const [claimedMilestones, setClaimedMilestones] = useState(() => store.getClaimedStreakMilestones() || {})
  const [loading, setLoading] = useState(() => !store.isRewardsCached())
  
  const [newReward, setNewReward] = useState('')
  const [newPunishment, setNewPunishment] = useState('')
  const [editingMilestone, setEditingMilestone] = useState(null)
  const [milestoneText, setMilestoneText] = useState('')

  // Loading states for async actions
  const [isAddingReward, setIsAddingReward] = useState(false)
  const [deletingRewardIndex, setDeletingRewardIndex] = useState(null)
  const [isAddingPunishment, setIsAddingPunishment] = useState(false)
  const [deletingPunishmentIndex, setDeletingPunishmentIndex] = useState(null)
  const [savingMilestoneDays, setSavingMilestoneDays] = useState(null)
  const [claimingMilestoneDays, setClaimingMilestoneDays] = useState(null)

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const archives = store.getAllArchives()
  const todayTasks = store.getTasks(todayStr)
  const currentStreakObj = scoring.getStreak(archives, todayTasks)
  const bestStreak = scoring.getBestStreak(archives, todayTasks)
  const effectiveStreak = Math.max(currentStreakObj.current || 0, bestStreak || 0)

  useEffect(() => {
    let isMounted = true;
    const loadRewardsData = async () => {
      const cachedR = store.getRewards()
      const cachedP = store.getPunishments()
      if (cachedR && cachedR.length > 0) setRewards(cachedR)
      if (cachedP && cachedP.length > 0) setPunishments(cachedP)
      setMilestones(store.getStreakMilestoneRewards() || {})
      setClaimedMilestones(store.getClaimedStreakMilestones() || {})

      if (store.isRewardsCached()) {
        setLoading(false)
      } else {
        setLoading(true)
      }

      const loadedRewards = await store.fetchRewardsApi()
      const loadedPunishments = await store.fetchPunishmentsApi()
      const milestoneData = await store.fetchStreakMilestonesApi()

      if (!isMounted) return;

      if (Array.isArray(loadedRewards)) setRewards(loadedRewards)
      if (Array.isArray(loadedPunishments)) setPunishments(loadedPunishments)
      if (milestoneData) {
        setMilestones(milestoneData.milestones || {})
        setClaimedMilestones(milestoneData.claimed || {})
      }
      setLoading(false)
    }

    loadRewardsData()
    return () => { isMounted = false; }
  }, [user])

  const handleAddReward = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const text = newReward.trim()
    if (!text || isAddingReward) return
    setIsAddingReward(true)
    try {
      const updated = await store.addRewardApi(text)
      setRewards(updated)
      setNewReward('')
    } catch (err) {
      console.error('Error adding reward:', err)
    } finally {
      setIsAddingReward(false)
    }
  }

  const handleDeleteReward = async (index) => {
    if (deletingRewardIndex !== null) return
    const currentList = Array.isArray(rewards) ? rewards : []
    const targetText = currentList[index]
    if (!targetText) return
    setDeletingRewardIndex(index)
    try {
      const updated = await store.deleteRewardApi(targetText)
      setRewards(updated)
    } catch (err) {
      console.error('Error deleting reward:', err)
    } finally {
      setDeletingRewardIndex(null)
    }
  }

  const handleAddPunishment = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const text = newPunishment.trim()
    if (!text || isAddingPunishment) return
    setIsAddingPunishment(true)
    try {
      const updated = await store.addPunishmentApi(text)
      setPunishments(updated)
      setNewPunishment('')
    } catch (err) {
      console.error('Error adding punishment:', err)
    } finally {
      setIsAddingPunishment(false)
    }
  }

  const handleDeletePunishment = async (index) => {
    if (deletingPunishmentIndex !== null) return
    const currentList = Array.isArray(punishments) ? punishments : []
    const targetText = currentList[index]
    if (!targetText) return
    setDeletingPunishmentIndex(index)
    try {
      const updated = await store.deletePunishmentApi(targetText)
      setPunishments(updated)
    } catch (err) {
      console.error('Error deleting punishment:', err)
    } finally {
      setDeletingPunishmentIndex(null)
    }
  }

  const handleEditMilestone = (days) => {
    setEditingMilestone(days)
    setMilestoneText(milestones[days] || '')
  }

  const handleSaveMilestone = async (days) => {
    if (savingMilestoneDays !== null) return
    setSavingMilestoneDays(days)
    const updated = { ...milestones, [days]: milestoneText.trim() }
    try {
      await store.saveStreakMilestonesApi(updated)
      setMilestones(updated)
      setEditingMilestone(null)
    } catch (err) {
      console.error('Error saving streak milestone:', err)
    } finally {
      setSavingMilestoneDays(null)
    }
  }

  const handleClaimMilestone = async (days) => {
    if (claimingMilestoneDays !== null) return
    setClaimingMilestoneDays(days)
    try {
      const updatedClaimed = await store.claimStreakMilestoneApi(days)
      setClaimedMilestones({ ...updatedClaimed })
    } catch (err) {
      console.error('Error claiming streak milestone:', err)
    } finally {
      setClaimingMilestoneDays(null)
    }
  }

  const milestoneDays = [7, 14, 30, 100]

  return (
    <div className="rewards-view animate-slide-up">
      <h1 className="rewards-title">🎁 Rewards & Penalties</h1>

      {loading ? (
        <div className="rewards-loading-skeleton" style={{ padding: '8px 0' }}>
          <div className="skeleton-box" style={{ width: '100%', height: '56px', borderRadius: 'var(--radius-lg)', marginBottom: '24px' }} />
          
          <div className="skeleton-box" style={{ width: '200px', height: '24px', borderRadius: '6px', marginBottom: '16px' }} />
          <div className="skeleton-box" style={{ width: '100%', height: '44px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }} />
          {[1, 2, 3].map(n => (
            <div key={n} className="skeleton-box" style={{ width: '100%', height: '50px', borderRadius: 'var(--radius-md)', marginBottom: '10px' }} />
          ))}

          <div className="skeleton-box" style={{ width: '200px', height: '24px', borderRadius: '6px', margin: '32px 0 16px' }} />
          <div className="skeleton-box" style={{ width: '100%', height: '44px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }} />
          {[1, 2, 3].map(n => (
            <div key={`p-${n}`} className="skeleton-box" style={{ width: '100%', height: '50px', borderRadius: 'var(--radius-md)', marginBottom: '10px' }} />
          ))}
        </div>
      ) : (
        <>
          <div className="card-glass rewards-info-card">
            <Info size={24} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
            <div className="rewards-info-text">
              <strong>How it works:</strong> Rating a task <strong>10/10</strong> unlocks a reward. Completing an overdue task or rating a task <strong>4 or below</strong> triggers a penalty. Set your 7, 14, 30 & 100-day streak rewards below—they automatically sync with your account!
            </div>
          </div>

          {/* Rewards Section */}
          <section className="rewards-section">
            <h2 className="rewards-section-title">
              <Gift color="var(--accent-success)" /> Random Rewards Pool
            </h2>
            
            <form onSubmit={handleAddReward} className="rewards-add-form">
              <input 
                type="text" 
                className="input"
                placeholder="e.g., Buy a coffee, 1hr gaming, guilt-free nap..." 
                value={newReward}
                onChange={(e) => setNewReward(e.target.value)}
                disabled={isAddingReward}
              />
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isAddingReward || !newReward.trim()} 
                style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: '84px', justifyContent: 'center' }}
              >
                {isAddingReward ? (
                  <>
                    <Loader2 size={16} className="btn-spinner" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Add</span>
                  </>
                )}
              </button>
            </form>

            <ul className="rewards-list">
              {rewards.length === 0 ? (
                <li className="card-glass rewards-list-empty animate-slide-up">No rewards added yet.</li>
              ) : (
                rewards.map((r, i) => (
                  <li key={i} className="rewards-list-item animate-slide-up" style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}>
                    <span>{r}</span>
                    <button 
                      onClick={() => handleDeleteReward(i)} 
                      className="btn-icon" 
                      style={{ color: 'var(--accent-danger)' }}
                      disabled={deletingRewardIndex === i}
                      title="Delete reward"
                    >
                      {deletingRewardIndex === i ? (
                        <Loader2 size={16} className="btn-spinner" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>

          {/* Punishments Section */}
          <section className="rewards-section">
            <h2 className="rewards-section-title">
              <AlertOctagon color="var(--accent-danger)" /> Random Penalties Pool
            </h2>
            
            <form onSubmit={handleAddPunishment} className="rewards-add-form">
              <input 
                type="text" 
                className="input"
                placeholder="e.g., No social media, 50 pushups, cold shower..." 
                value={newPunishment}
                onChange={(e) => setNewPunishment(e.target.value)}
                disabled={isAddingPunishment}
              />
              <button 
                type="submit" 
                className="btn btn-danger" 
                disabled={isAddingPunishment || !newPunishment.trim()} 
                style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: '84px', justifyContent: 'center' }}
              >
                {isAddingPunishment ? (
                  <>
                    <Loader2 size={16} className="btn-spinner" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Add</span>
                  </>
                )}
              </button>
            </form>

            <ul className="rewards-list">
              {punishments.length === 0 ? (
                <li className="card-glass rewards-list-empty animate-slide-up">No penalties added yet.</li>
              ) : (
                punishments.map((p, i) => (
                  <li key={i} className="rewards-list-item animate-slide-up" style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}>
                    <span>{p}</span>
                    <button 
                      onClick={() => handleDeletePunishment(i)} 
                      className="btn-icon" 
                      style={{ color: 'var(--accent-danger)' }}
                      disabled={deletingPunishmentIndex === i}
                      title="Delete penalty"
                    >
                      {deletingPunishmentIndex === i ? (
                        <Loader2 size={16} className="btn-spinner" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>

          {/* Streak Milestones */}
          <section>
            <h2 className="rewards-section-title">🔥 Streak Milestones</h2>
            <div className="milestones-grid">
              {milestoneDays.map((days, idx) => {
                const hasReward = Boolean(milestones[days])
                const isUnlocked = effectiveStreak >= days
                const isClaimed = Boolean(claimedMilestones[days])
                const isSavingThis = savingMilestoneDays === days

                return (
                  <div key={days} className={`card-glass milestone-card animate-slide-up ${isUnlocked && hasReward ? 'milestone-unlocked' : ''}`} style={{ animationDelay: `${idx * 0.05}s` }}>
                    <div className="milestone-header">
                      <span className="milestone-days">{days} Days</span>
                      {editingMilestone !== days ? (
                        <button onClick={() => handleEditMilestone(days)} className="btn-icon" title="Edit reward"><Edit2 size={16} /></button>
                      ) : (
                        <button 
                          onClick={() => handleSaveMilestone(days)} 
                          className="btn-icon" 
                          style={{ color: 'var(--accent-success)' }} 
                          disabled={isSavingThis}
                          title="Save reward"
                        >
                          {isSavingThis ? (
                            <Loader2 size={16} className="btn-spinner" />
                          ) : (
                            <Check size={18} />
                          )}
                        </button>
                      )}
                    </div>
                    
                    {editingMilestone === days ? (
                      <div style={{ marginTop: '6px' }}>
                        <textarea 
                          className="input"
                          value={milestoneText}
                          onChange={(e) => setMilestoneText(e.target.value)}
                          placeholder="What is your reward for this streak?"
                          autoFocus
                          disabled={isSavingThis}
                          style={{ resize: 'vertical', minHeight: '60px', width: '100%' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditingMilestone(null)}
                            disabled={isSavingThis}
                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSaveMilestone(days)}
                            disabled={isSavingThis}
                            style={{ padding: '4px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            {isSavingThis ? (
                              <>
                                <Loader2 size={13} className="btn-spinner" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <Check size={14} />
                                <span>Save</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={milestones[days] ? 'milestone-text milestone-text--filled' : 'milestone-text milestone-text--empty'}>
                          {milestones[days] || 'No reward set yet.'}
                        </div>

                        {hasReward && isUnlocked ? (
                          <div style={{ marginTop: '12px' }}>
                            {isClaimed ? (
                              <span className="milestone-badge milestone-badge-claimed">
                                Claimed ✓
                              </span>
                            ) : (
                              <button 
                                onClick={() => handleClaimMilestone(days)}
                                className="btn btn-primary milestone-claim-btn"
                                disabled={claimingMilestoneDays === days}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                {claimingMilestoneDays === days ? (
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
                            )}
                          </div>
                        ) : (
                          <div className="milestone-progress-sub">
                            🔥 {Math.min(effectiveStreak, days)} / {days} Days
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
