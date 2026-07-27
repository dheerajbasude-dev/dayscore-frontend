import { useState, useEffect, useRef } from 'react'
import { Trash2, Download, Upload, AlertTriangle, Moon, Sun, Bell, Plus, X, Pencil, Settings as SettingsIcon, Loader2 } from 'lucide-react'
import { format, addHours } from 'date-fns'
import * as store from '../store/store'
import { useTheme } from '../hooks/useTheme'
import { triggerDesktopNotification } from '../hooks/useNotifications'
import { useAuth } from '../context/AuthContext'

export default function SettingsView() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [settings, setSettings] = useState(() => store.getSettings())
  const [templates, setTemplates] = useState(() => store.getTemplates())
  const [loading, setLoading] = useState(() => !store.isSettingsCached())
  const [showAddTemplate, setShowAddTemplate] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [deletingTemplateId, setDeletingTemplateId] = useState(null)
  const fileInputRef = useRef(null)

  const [tTitle, setTTitle] = useState('')
  const [tCategory, setTCategory] = useState('Work')
  const [tPriority, setTPriority] = useState('Med')

  const todayDateStr = format(new Date(), 'yyyy-MM-dd')
  const [tDate, setTDate] = useState(todayDateStr)
  const [tHour, setTHour] = useState(() => addHours(new Date(), 2).getHours())
  const [tMinute, setTMinute] = useState(() => addHours(new Date(), 2).getMinutes())

  const now = new Date()
  const isSelectedToday = tDate === todayDateStr
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  const handleOpenAddTemplate = () => {
    setEditingTemplate(null)
    const initialDate = format(new Date(), 'yyyy-MM-dd')
    const initialDue = addHours(new Date(), 2)
    setTDate(initialDate)
    setTHour(initialDue.getHours())
    setTMinute(initialDue.getMinutes())
    setTTitle('')
    setTCategory('Work')
    setTPriority('Med')
    setShowAddTemplate(true)
  }

  const handleEditTemplate = (t) => {
    setEditingTemplate(t)
    setTTitle(t.title || '')
    setTCategory(t.category || 'Work')
    setTPriority(t.priority || 'Med')

    const todayStr = format(new Date(), 'yyyy-MM-dd')
    setTDate(t.defaultDate && t.defaultDate >= todayStr ? t.defaultDate : todayStr)

    if (t.defaultHour !== undefined && t.defaultHour !== null) {
      setTHour(t.defaultHour)
    } else if (t.relativeTime) {
      const parts = t.relativeTime.split(':').map(Number)
      if (!isNaN(parts[0])) setTHour(parts[0])
    }

    if (t.defaultMinute !== undefined && t.defaultMinute !== null) {
      setTMinute(t.defaultMinute)
    } else if (t.relativeTime) {
      const parts = t.relativeTime.split(':').map(Number)
      if (parts.length === 2 && !isNaN(parts[1])) setTMinute(parts[1])
    }

    setShowAddTemplate(true)
  }

  // Clamp hour/minute if today is selected and selected time is in the past
  useEffect(() => {
    if (isSelectedToday) {
      if (tHour < currentHour) {
        setTHour(currentHour)
        setTMinute(Math.min(currentMinute + 5, 59))
      } else if (tHour === currentHour && tMinute < currentMinute) {
        setTMinute(Math.min(currentMinute + 5, 59))
      }
    }
  }, [tDate, isSelectedToday, currentHour, currentMinute, tHour, tMinute])

  const setTemplatePresetTime = (minutesToAdd) => {
    const target = new Date(Date.now() + minutesToAdd * 60 * 1000)
    setTDate(format(target, 'yyyy-MM-dd'))
    setTHour(target.getHours())
    setTMinute(target.getMinutes())
  }

  const setTemplateEndOfDay = () => {
    setTDate(todayDateStr)
    setTHour(23)
    setTMinute(59)
  }

  useEffect(() => {
    let isMounted = true;
    const loadSettingsData = async () => {
      // Instant cache load so switching tabs has ZERO delay and no re-triggering of loading spinners!
      const cached = store.getSettings()
      if (cached) setSettings(cached)
      setTemplates(store.getTemplates())

      if (store.isSettingsCached()) {
        setLoading(false)
      } else {
        setLoading(true)
      }

      const userSettings = await store.fetchSettingsApi()
      const userTemplates = await store.fetchTemplatesApi()
      if (!isMounted) return;
      setSettings(userSettings)
      setTemplates(userTemplates || store.getTemplates())
      setLoading(false)
    }

    loadSettingsData()
    return () => { isMounted = false; }
  }, [user])

  const handleToggleNotifications = async () => {
    const nextState = !settings.notifications
    const newSettings = { ...settings, notifications: nextState }
    store.saveSettings(newSettings)
    setSettings(newSettings)
  }

  const handleReminderChange = (minutes) => {
    const newSettings = { ...settings, reminderLeadTime: minutes }
    store.saveSettings(newSettings)
    setSettings(newSettings)
  }

  const handleTestNotification = async () => {
    const minutes = settings.reminderLeadTime ?? 30
    const label = minutes === 0 ? 'at exact due time' : `${minutes} minutes before due time`
    const sent = await triggerDesktopNotification(
      '⏰ DayScore Reminders Active!',
      `Desktop Notification Test Successful!\nReminders set to trigger ${label}.`
    )
    if (!sent) {
      alert("⚠️ Notification permission is required. Please check your browser address bar permissions and ensure notifications are allowed for this site.")
    }
  }

  const handleSaveTemplate = async (e) => {
    e.preventDefault()
    if (!tTitle.trim() || isSavingTemplate) return

    const [year, month, day] = tDate.split('-').map(Number)
    const dueObj = new Date(year, month - 1, day, tHour, tMinute, 0)

    const currentTime = new Date()
    if (dueObj < currentTime) {
      alert("⚠️ Default due date & time cannot be in the past! Please select a valid current or future date and time.")
      setTDate(format(currentTime, 'yyyy-MM-dd'))
      setTHour(currentTime.getHours())
      setTMinute(Math.min(currentTime.getMinutes() + 5, 59))
      return
    }

    const pad = (num) => String(num).padStart(2, '0')
    const relativeTime = `${pad(tHour)}:${pad(tMinute)}`

    const templatePayload = {
      id: editingTemplate ? editingTemplate.id : undefined,
      title: tTitle.trim(),
      category: tCategory,
      priority: tPriority,
      defaultDate: tDate,
      defaultHour: tHour,
      defaultMinute: tMinute,
      relativeTime
    }

    setIsSavingTemplate(true)
    try {
      const updated = await store.saveTemplateApi(templatePayload)
      setTemplates(updated)
      setEditingTemplate(null)
      setShowAddTemplate(false)
    } finally {
      setIsSavingTemplate(false)
    }
  }

  const handleDeleteTemplate = async (id) => {
    if (deletingTemplateId === id) return
    setDeletingTemplateId(id)
    try {
      const updated = await store.deleteTemplateApi(id)
      setTemplates(updated)
    } finally {
      setDeletingTemplateId(null)
    }
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

      <div className="settings-header-banner">
        <div className="settings-header-icon-wrapper">
          <SettingsIcon size={24} />
        </div>
        <div>
          <h1 className="settings-page-title">Settings & Preferences</h1>
          <p className="settings-page-subtitle">Configure app theme, notification lead times, templates, and data backups</p>
        </div>
      </div>

      {loading ? (
        <div className="settings-loading-skeleton" style={{ padding: '8px 0' }}>
          <div className="skeleton-box" style={{ width: '100%', height: '140px', borderRadius: 'var(--radius-lg)', marginBottom: '24px' }} />
          <div className="skeleton-box" style={{ width: '100%', height: '180px', borderRadius: 'var(--radius-lg)', marginBottom: '24px' }} />
          <div className="skeleton-box" style={{ width: '100%', height: '120px', borderRadius: 'var(--radius-lg)' }} />
        </div>
      ) : (
        <>
          {/* Appearance & Notifications */}
          <div className="card-glass settings-card">
            <h2 className="settings-section-title">APPEARANCE & NOTIFICATIONS</h2>

            <div className="settings-row">
              <div className="settings-row-left">
                <div className="settings-row-icon">
                  {theme === 'dark' ? <Moon size={18} color="var(--accent-primary)" /> : <Sun size={18} color="var(--accent-primary)" />}
                </div>
                <div>
                  <div className="settings-row-label">Dark Theme Mode</div>
                  <div className="settings-row-sublabel">Toggle between sleek dark and vibrant light themes</div>
                </div>
              </div>
              <Toggle active={theme === 'dark'} onClick={toggleTheme} />
            </div>

            <div className="settings-row settings-row--bordered">
              <div className="settings-row-left">
                <div className="settings-row-icon">
                  <Bell size={18} color={settings.notifications ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                </div>
                <div>
                  <div className="settings-row-label">Desktop Task Reminders</div>
                  <div className="settings-row-sublabel">
                    {settings.notifications 
                      ? (settings.reminderLeadTime === 0 ? 'Notifies at exact due time' : `Notifies ${settings.reminderLeadTime ?? 30} min before due time`)
                      : 'Desktop notifications disabled'}
                  </div>
                </div>
              </div>
              <Toggle active={settings.notifications} onClick={handleToggleNotifications} />
            </div>

            {/* Lead time selection */}
            {settings.notifications && (
              <div className="settings-notification-panel">
                <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '8px' }}>Notification Lead Time</label>
                <div className="settings-segmented-grid">
                  {[
                    { label: 'At Due Time', value: 0 },
                    { label: '15 Min Before', value: 15 },
                    { label: '30 Min Before', value: 30 },
                    { label: '1 Hour Before', value: 60 },
                  ].map(opt => (
                    <div
                      key={opt.value}
                      className={`segmented-option ${(settings.reminderLeadTime ?? 30) === opt.value ? 'active' : ''}`}
                      onClick={() => handleReminderChange(opt.value)}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    onClick={handleTestNotification}
                    style={{ fontSize: '0.78rem', gap: '6px', padding: '6px 12px' }}
                  >
                    🔔 Send Test Notification
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Task Templates */}
          <div className="card-glass settings-card">
            <div className="settings-card-header">
              <div>
                <h2 className="settings-section-title">TASK TEMPLATES</h2>
                <p className="settings-card-subtitle">Quickly launch reusable routines and structured tasks</p>
              </div>
              <button onClick={handleOpenAddTemplate} className="btn btn-primary btn-sm" style={{ gap: '6px' }}>
                <Plus size={16} /> Add Template
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="settings-empty-card">
                <p className="settings-empty-note">No templates created yet. Click "+ Add Template" to create a quick reusable task!</p>
              </div>
            ) : (
              <div className="settings-template-grid">
                {templates.map((t, idx) => (
                  <div key={t.id} className="settings-template-card">
                    <div className="settings-template-card-main">
                      <div className="settings-template-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--accent-primary)', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '4px', padding: '1px 5px', flexShrink: 0 }}>
                          #{idx + 1}
                        </span>
                        <span>{t.title}</span>
                      </div>
                      <div className="settings-template-badges">
                        <span className="badge badge-cat">{t.category}</span>
                        <span className="badge badge-pri">{t.priority}</span>
                        {t.relativeTime && <span className="settings-template-time">⏰ {t.relativeTime}</span>}
                      </div>
                    </div>
                    <div className="settings-template-actions">
                      <button 
                        onClick={() => handleEditTemplate(t)} 
                        className="btn-icon settings-action-btn edit" 
                        title="Edit template"
                        disabled={deletingTemplateId === t.id}
                      >
                        <Pencil size={15} />
                      </button>
                      <button 
                        onClick={() => handleDeleteTemplate(t.id)} 
                        className="btn-icon settings-action-btn delete" 
                        title="Delete template"
                        disabled={deletingTemplateId === t.id}
                      >
                        {deletingTemplateId === t.id ? (
                          <Loader2 className="animate-spin" size={15} />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Data Management */}
          <div className="card-glass settings-card">
            <h2 className="settings-section-title">DATA MANAGEMENT</h2>

            <div className="settings-row settings-row--bordered">
              <div>
                <div className="settings-row-label">Export Workspace Backup</div>
                <div className="settings-row-sublabel">Download a complete JSON snapshot of all tasks, scores & streak history</div>
              </div>
              <button onClick={handleExport} className="btn btn-secondary" style={{ gap: '6px' }}>
                <Download size={16} /> Export JSON
              </button>
            </div>

            <div className="settings-row settings-row--bordered">
              <div>
                <div className="settings-row-label">Restore from Backup</div>
                <div className="settings-row-sublabel">Import and restore tasks from a previously saved JSON backup file</div>
              </div>
              <button onClick={() => fileInputRef.current.click()} className="btn btn-secondary" style={{ gap: '6px' }}>
                <Upload size={16} /> Import JSON
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" style={{ display: 'none' }} />
            </div>

            <div className="settings-danger-card">
              <div className="settings-danger-header">
                <AlertTriangle size={20} className="settings-danger-icon" />
                <div>
                  <div className="settings-danger-title">Danger Zone</div>
                  <div className="settings-danger-sub">Permanently delete all local tasks, archives, streaks, and custom templates. This action cannot be undone.</div>
                </div>
              </div>
              <button onClick={handleReset} className="btn settings-reset-btn">
                <Trash2 size={15} /> Reset All Data
              </button>
            </div>
          </div>
        </>
      )}

      {/* Template Modal */}
      {showAddTemplate && (
        <div className="modal-overlay" onClick={() => !isSavingTemplate && setShowAddTemplate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingTemplate ? 'Edit Template' : 'New Template'}</h2>
              <button className="btn-icon" onClick={() => !isSavingTemplate && setShowAddTemplate(false)} disabled={isSavingTemplate}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input required type="text" className="input" value={tTitle} onChange={e => setTTitle(e.target.value)} placeholder="Task title" autoFocus disabled={isSavingTemplate} />
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <div className="segmented">
                  {['Work', 'Learning', 'Health', 'Personal'].map(cat => (
                    <div key={cat} className={`segmented-option ${tCategory === cat ? 'active' : ''}`} onClick={() => !isSavingTemplate && setTCategory(cat)}>{cat}</div>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <div className="segmented">
                  {['High', 'Med', 'Low'].map(pri => (
                    <div key={pri} className={`segmented-option ${tPriority === pri ? 'active' : ''}`} onClick={() => !isSavingTemplate && setTPriority(pri)}>{pri}</div>
                  ))}
                </div>
              </div>

              {/* Custom Date & Time Restrictions for Template */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Default Due Time</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: '700' }}>
                    ⏰ {(() => {
                      try {
                        const ampm = tHour >= 12 ? 'PM' : 'AM';
                        const displayH = tHour % 12 === 0 ? 12 : tHour % 12;
                        return `${String(displayH).padStart(2, '0')}:${String(tMinute).padStart(2, '0')} ${ampm} (Applies to active date)`;
                      } catch {
                        return '';
                      }
                    })()}
                  </span>
                </label>

                {/* Quick Presets */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTemplatePresetTime(30)} disabled={isSavingTemplate} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>+30 Min</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTemplatePresetTime(60)} disabled={isSavingTemplate} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>+1 Hour</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTemplatePresetTime(120)} disabled={isSavingTemplate} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>+2 Hours</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={setTemplateEndOfDay} disabled={isSavingTemplate} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>End of Day (11:59 PM)</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '8px' }}>
                  {/* Date Input */}
                  <input
                    type="date"
                    className="input"
                    min={todayDateStr}
                    value={tDate}
                    onChange={e => {
                      const val = e.target.value;
                      if (val && val >= todayDateStr) {
                        setTDate(val);
                      }
                    }}
                    required
                    disabled={isSavingTemplate}
                    style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                  />

                  {/* Hour Dropdown */}
                  <select
                    className="select"
                    value={tHour}
                    onChange={e => setTHour(Number(e.target.value))}
                    disabled={isSavingTemplate}
                    style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                  >
                    {Array.from({ length: 24 }).map((_, h) => {
                      const isPast = isSelectedToday && h < currentHour;
                      const ampm = h >= 12 ? 'PM' : 'AM';
                      const displayH = h % 12 === 0 ? 12 : h % 12;
                      return (
                        <option key={h} value={h} disabled={isPast}>
                          {String(displayH).padStart(2, '0')}:00 {ampm} {isPast ? '(Past)' : ''}
                        </option>
                      );
                    })}
                  </select>

                  {/* Minute Dropdown */}
                  <select
                    className="select"
                    value={tMinute}
                    onChange={e => setTMinute(Number(e.target.value))}
                    disabled={isSavingTemplate}
                    style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                  >
                    {Array.from({ length: 60 }).map((_, m) => {
                      const isPast = isSelectedToday && tHour === currentHour && m < currentMinute;
                      return (
                        <option key={m} value={m} disabled={isPast}>
                          :{String(m).padStart(2, '0')} {isPast ? '(Past)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddTemplate(false)} disabled={isSavingTemplate}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSavingTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {isSavingTemplate ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      {editingTemplate ? 'Updating...' : 'Saving...'}
                    </>
                  ) : (
                    editingTemplate ? 'Update' : 'Save'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
