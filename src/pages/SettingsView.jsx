import { useState, useEffect, useRef } from 'react'
import { Trash2, Download, Upload, AlertTriangle, Moon, Sun, Bell, Plus, X } from 'lucide-react'
import * as store from '../store/store'
import { useTheme } from '../hooks/useTheme'
import { triggerDesktopNotification } from '../hooks/useNotifications'
import { useAuth } from '../context/AuthContext'

export default function SettingsView() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [settings, setSettings] = useState({ notifications: false })
  const [templates, setTemplates] = useState([])
  const [showAddTemplate, setShowAddTemplate] = useState(false)
  const fileInputRef = useRef(null)

  const [tTitle, setTTitle] = useState('')
  const [tCategory, setTCategory] = useState('Work')
  const [tPriority, setTPriority] = useState('Med')
  const [tRelativeTime, setTRelativeTime] = useState('')

  useEffect(() => {
    let isMounted = true;
    const loadSettingsData = async () => {
      const userSettings = await store.fetchSettingsApi()
      if (!isMounted) return;
      setSettings(userSettings)
      setTemplates(store.getTemplates())
    }

    loadSettingsData()
    return () => { isMounted = false; }
  }, [user])

  const handleToggleNotifications = async () => {
    const nextState = !settings.notifications
    const newSettings = { ...settings, notifications: nextState }
    store.saveSettings(newSettings)
    setSettings(newSettings)
    if (nextState && 'Notification' in window) {
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') {
          alert('Notification permission was blocked. Please enable notification permissions in your browser address bar.')
        }
      }
    }
  }

  const handleUpdateReminderLeadTime = (minutes) => {
    const newSettings = { ...settings, reminderLeadTime: minutes }
    store.saveSettings(newSettings)
    setSettings(newSettings)
  }

  const handleTestNotification = async () => {
    const minutes = settings.reminderLeadTime ?? 30
    const label = minutes === 0 ? 'at exact due time' : `${minutes} minutes before due time`
    await triggerDesktopNotification(
      '⏰ DayScore Reminders Active!',
      `Desktop Notification Test Successful!\nReminders set to trigger ${label}.`
    )
  }

  const handleAddTemplate = (e) => {
    e.preventDefault()
    if (!tTitle.trim()) return
    const newTemplate = { id: Date.now().toString(), title: tTitle.trim(), category: tCategory, priority: tPriority, relativeTime: tRelativeTime || null }
    const updated = [...templates, newTemplate]
    store.saveTemplates(updated)
    setTemplates(updated)
    setTTitle(''); setTCategory('Work'); setTPriority('Med'); setTRelativeTime('')
    setShowAddTemplate(false)
  }

  const handleDeleteTemplate = (id) => {
    const updated = templates.filter(t => t.id !== id)
    store.saveTemplates(updated)
    setTemplates(updated)
  }

  const handleExport = () => {
    const dataStr = store.exportAllData()
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `dayscore-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const res = store.importAllData(event.target.result)
      if (res.success) { alert('Data imported successfully! App will now reload.'); window.location.reload() }
      else alert('Error importing data: ' + res.message)
    }
    reader.readAsText(file)
  }

  const handleReset = () => {
    if (window.confirm("🚨 This will delete ALL data permanently. Continue?")) { store.resetAllData(); window.location.reload() }
  }

  const Toggle = ({ active, onClick }) => (
    <button onClick={onClick} style={{ width: '44px', height: '24px', borderRadius: '12px', background: active ? 'var(--accent-primary)' : 'var(--bg-tertiary)', position: 'relative', border: '1px solid var(--border-glass)', cursor: 'pointer', transition: 'background 0.3s', flexShrink: 0 }}>
      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: active ? '22px' : '2px', transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )

  return (
    <div className="settings-view">

      <h1 className="settings-title">⚙️ Settings</h1>

      {/* Appearance */}
      <div className="card-glass settings-card">
        <h2 className="settings-section-title">Appearance</h2>
        
        <div className="settings-row settings-row--bordered">
          <div className="settings-row-left">
            {theme === 'dark' ? <Moon size={20} color="var(--accent-primary)" /> : <Sun size={20} color="var(--accent-primary)" />}
            <span className="settings-row-label">Dark Mode</span>
          </div>
          <Toggle active={theme === 'dark'} onClick={toggleTheme} />
        </div>

        <div className="settings-row settings-row--top-padded">
          <div className="settings-row-left">
            <Bell size={20} color={settings.notifications ? 'var(--accent-primary)' : 'var(--text-muted)'} />
            <div>
              <div className="settings-row-label">Reminders</div>
              <div className="settings-row-sublabel">
                {settings.notifications 
                  ? (settings.reminderLeadTime === 0 ? 'Notifies at exact due time' : `Notifies ${settings.reminderLeadTime ?? 30} min before due time`)
                  : 'Desktop reminders disabled'}
              </div>
            </div>
          </div>
          <Toggle active={settings.notifications} onClick={handleToggleNotifications} />
        </div>

        {settings.notifications && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Reminder Timing Choice</label>
              <select
                className="input"
                value={settings.reminderLeadTime ?? 30}
                onChange={(e) => handleUpdateReminderLeadTime(Number(e.target.value))}
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: '8px', padding: '8px 12px' }}
              >
                <option value={5}>5 minutes before due time</option>
                <option value={15}>15 minutes before due time</option>
                <option value={30}>30 minutes before due time</option>
                <option value={60}>1 hour before due time</option>
                <option value={0}>At exact due time</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button 
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleTestNotification}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Bell size={14} /> Send Test Notification
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Templates */}
      <div className="card-glass settings-card">
        <div className="settings-templates-header">
          <h2 className="settings-section-title" style={{ margin: 0 }}>Task Templates</h2>
          <button onClick={() => setShowAddTemplate(true)} className="btn btn-primary btn-sm">
            <Plus size={14} /> New
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="settings-templates-empty">
            No templates yet. Create one for recurring tasks.
          </div>
        ) : (
          <div className="settings-templates-list">
            {templates.map(t => (
              <div key={t.id} className="settings-template-item">
                <div className="settings-template-info">
                  <div className="settings-template-title">{t.title}</div>
                  <div className="settings-template-meta">
                    <span className={`badge badge-${t.category.toLowerCase()}`}>{t.category}</span>
                  </div>
                </div>
                <button onClick={() => handleDeleteTemplate(t.id)} className="btn-icon" style={{ color: 'var(--accent-danger)', width: '30px', height: '30px' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data */}
      <div className="card-glass">
        <h2 className="settings-section-title">Data</h2>
        
        <div className="settings-data-buttons">
          <button onClick={handleExport} className="btn btn-secondary">
            <Download size={16} /> Export
          </button>
          <button onClick={() => fileInputRef.current.click()} className="btn btn-secondary">
            <Upload size={16} /> Import
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" style={{ display: 'none' }} />
        </div>

        <div className="settings-reset-section">
          <button onClick={handleReset} className="btn settings-reset-btn">
            <AlertTriangle size={16} /> Reset All Data
          </button>
          <p className="settings-reset-note">This cannot be undone.</p>
        </div>
      </div>

      {/* Template Modal */}
      {showAddTemplate && (
        <div className="modal-overlay" onClick={() => setShowAddTemplate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Template</h2>
              <button className="btn-icon" onClick={() => setShowAddTemplate(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input required type="text" className="input" value={tTitle} onChange={e => setTTitle(e.target.value)} placeholder="Task title" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <div className="segmented">
                  {['Work', 'Learning', 'Health', 'Personal'].map(cat => (
                    <div key={cat} className={`segmented-option ${tCategory === cat ? 'active' : ''}`} onClick={() => setTCategory(cat)}>{cat}</div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <div className="segmented">
                  {['High', 'Med', 'Low'].map(pri => (
                    <div key={pri} className={`segmented-option ${tPriority === pri ? 'active' : ''}`} onClick={() => setTPriority(pri)}>{pri}</div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Default Due Time</label>
                <input type="time" className="input" value={tRelativeTime} onChange={e => setTRelativeTime(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddTemplate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
