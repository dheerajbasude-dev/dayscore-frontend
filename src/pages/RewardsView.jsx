import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Check, Gift, AlertOctagon, Info, History } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import * as store from '../store/store'
import { useAuth } from '../context/AuthContext'

export default function RewardsView() {
  const { user } = useAuth()
  const [rewards, setRewards] = useState(() => store.getRewards())
  const [punishments, setPunishments] = useState(() => store.getPunishments())
  const [milestones, setMilestones] = useState(() => store.getStreakMilestoneRewards() || {})
  const [loading, setLoading] = useState(() => !store.isRewardsCached())
  
  const [newReward, setNewReward] = useState('')
  const [newPunishment, setNewPunishment] = useState('')
  const [editingMilestone, setEditingMilestone] = useState(null)
  const [milestoneText, setMilestoneText] = useState('')

  useEffect(() => {
    let isMounted = true;
    const loadRewardsData = async () => {
      // Instant cache load so switching tabs has ZERO delay and no re-triggering of loading spinners!
      const cachedR = store.getRewards()
      const cachedP = store.getPunishments()
      if (cachedR && cachedR.length > 0) setRewards(cachedR)
      if (cachedP && cachedP.length > 0) setPunishments(cachedP)
      setMilestones(store.getStreakMilestoneRewards() || {})

      if (store.isRewardsCached()) {
        setLoading(false)
      } else {
        setLoading(true)
      }

      const loadedRewards = await store.fetchRewardsApi()
      const loadedPunishments = await store.fetchPunishmentsApi()
      if (!isMounted) return;

      if (Array.isArray(loadedRewards)) setRewards(loadedRewards)
      if (Array.isArray(loadedPunishments)) setPunishments(loadedPunishments)
      setMilestones(store.getStreakMilestoneRewards() || {})
      setLoading(false)
    }

    loadRewardsData()
    return () => { isMounted = false; }
  }, [user])

  const handleAddReward = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const text = newReward.trim()
    if (!text) return
    const updated = await store.addRewardApi(text)
    setRewards(updated)
    setNewReward('')
  }

  const handleDeleteReward = async (index) => {
    const currentList = Array.isArray(rewards) ? rewards : []
    const targetText = currentList[index]
    if (!targetText) return
    const updated = await store.deleteRewardApi(targetText)
    setRewards(updated)
  }

  const handleAddPunishment = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const text = newPunishment.trim()
    if (!text) return
    const updated = await store.addPunishmentApi(text)
    setPunishments(updated)
    setNewPunishment('')
  }

  const handleDeletePunishment = async (index) => {
    const currentList = Array.isArray(punishments) ? punishments : []
    const targetText = currentList[index]
    if (!targetText) return
    const updated = await store.deletePunishmentApi(targetText)
    setPunishments(updated)
  }

  const handleEditMilestone = (days) => {
    setEditingMilestone(days)
    setMilestoneText(milestones[days] || '')
  }

  const handleSaveMilestone = (days) => {
    const updated = { ...milestones, [days]: milestoneText }
    store.saveStreakMilestoneRewards(updated)
    setMilestones(updated)
    setEditingMilestone(null)
  }

  const milestoneDays = [7, 14, 30, 100]

  return (
    <div className="rewards-view">
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
              <strong>How it works:</strong> Rating a task <strong>10/10</strong> unlocks a reward. Completing an overdue task or rating a task <strong>4 or below</strong> triggers a penalty. Track your claims below.
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
              />
              <button type="button" onClick={handleAddReward} className="btn btn-primary" style={{ flexShrink: 0 }}>
                <Plus size={16} /> Add
              </button>
            </form>

            <ul className="rewards-list">
              {rewards.length === 0 ? (
                <li className="card-glass rewards-list-empty">No rewards added yet.</li>
              ) : (
                rewards.map((r, i) => (
                  <li key={i} className="rewards-list-item">
                    <span>{r}</span>
                    <button onClick={() => handleDeleteReward(i)} className="btn-icon" style={{ color: 'var(--accent-danger)' }}>
                      <Trash2 size={18} />
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
              />
              <button type="button" onClick={handleAddPunishment} className="btn btn-danger" style={{ flexShrink: 0 }}>
                <Plus size={16} /> Add
              </button>
            </form>

            <ul className="rewards-list">
              {punishments.length === 0 ? (
                <li className="card-glass rewards-list-empty">No penalties added yet.</li>
              ) : (
                punishments.map((p, i) => (
                  <li key={i} className="rewards-list-item">
                    <span>{p}</span>
                    <button onClick={() => handleDeletePunishment(i)} className="btn-icon" style={{ color: 'var(--accent-danger)' }}>
                      <Trash2 size={18} />
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
              {milestoneDays.map(days => (
                <div key={days} className="card-glass milestone-card">
                  <div className="milestone-header">
                    <span className="milestone-days">{days} Days</span>
                    {editingMilestone !== days ? (
                      <button onClick={() => handleEditMilestone(days)} className="btn-icon"><Edit2 size={16} /></button>
                    ) : (
                      <button onClick={() => handleSaveMilestone(days)} className="btn-icon" style={{ color: 'var(--accent-success)' }}><Check size={18} /></button>
                    )}
                  </div>
                  
                  {editingMilestone === days ? (
                    <textarea 
                      className="input"
                      value={milestoneText}
                      onChange={(e) => setMilestoneText(e.target.value)}
                      placeholder="What is your big reward?"
                      autoFocus
                      style={{ resize: 'vertical', minHeight: '60px' }}
                    />
                  ) : (
                    <div className={milestones[days] ? 'milestone-text milestone-text--filled' : 'milestone-text milestone-text--empty'}>
                      {milestones[days] || 'No reward set yet.'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
