import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, Download, Upload, AlertTriangle, Moon, Sun, Bell, Plus, X, Pencil, Settings as SettingsIcon, Loader2, Calendar as CalendarIcon, Clock, ChevronDown, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { format, addHours, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns'
import * as store from '../store/store'
import { useTheme } from '../hooks/useTheme'
import { triggerDesktopNotification, playNotificationSound } from '../hooks/useNotifications'
import { useAuth } from '../context/AuthContext'
import { subscribeToPushNotifications, unsubscribePushNotifications, dispatchTestPushNotification, isPushNotificationSupported } from '../utils/pushManager'

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
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const fileInputRef = useRef(null)

  const [isTDatePickerOpen, setIsTDatePickerOpen] = useState(false)
  const [isTHourPickerOpen, setIsTHourPickerOpen] = useState(false)
  const [isTMinutePickerOpen, setIsTMinutePickerOpen] = useState(false)

  const tDatePickerRef = useRef(null)
  const tHourPickerRef = useRef(null)
  const tMinutePickerRef = useRef(null)

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (showAddTemplate || showResetModal) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
    return () => document.body.classList.remove('modal-open')
  }, [showAddTemplate, showResetModal])

  // Click outside for template modal popovers
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tDatePickerRef.current && !tDatePickerRef.current.contains(e.target)) {
        setIsTDatePickerOpen(false)
      }
      if (tHourPickerRef.current && !tHourPickerRef.current.contains(e.target)) {
        setIsTHourPickerOpen(false)
      }
      if (tMinutePickerRef.current && !tMinutePickerRef.current.contains(e.target)) {
        setIsTMinutePickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [tTitle, setTTitle] = useState('')
  const [tCategory, setTCategory] = useState('Work')
  const [tPriority, setTPriority] = useState('Med')

  const todayDateStr = format(new Date(), 'yyyy-MM-dd')
  const [tDate, setTDate] = useState(todayDateStr)
  const [tHour, setTHour] = useState(() => addHours(new Date(), 2).getHours())
  const [tMinute, setTMinute] = useState(() => addHours(new Date(), 2).getMinutes())

  const [tCalendarViewDate, setTCalendarViewDate] = useState(() => {
    try { return parseISO(todayDateStr); } catch { return new Date(); }
  })

  const formatDisplayTDate = (dStr) => {
    try {
      const parsed = parseISO(dStr);
      if (!isNaN(parsed.getTime())) return format(parsed, 'MMM d, yyyy');
    } catch {}
    return dStr;
  };

  const tMonthStart = startOfMonth(tCalendarViewDate);
  const tMonthEnd = endOfMonth(tCalendarViewDate);
  const tDaysInMonth = eachDayOfInterval({ start: tMonthStart, end: tMonthEnd });
  const tStartDayOffset = getDay(tMonthStart);

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

  const [isPushSubscribing, setIsPushSubscribing] = useState(false)
  const [testPushStatus, setTestPushStatus] = useState('')

  const handleToggleNotifications = async () => {
    if (isPushSubscribing) return
    const nextState = !settings.notifications
    if (nextState) {
      setIsPushSubscribing(true)
      try {
        await subscribeToPushNotifications()
        const newSettings = { ...settings, notifications: true }
        setSettings(newSettings)
        await store.saveSettings(newSettings)
      } catch (err) {
        console.warn('Push subscription failed:', err)
        alert('⚠️ Notification permission is required for background reminders.\n\nPlease check your browser address bar permissions and ensure notifications are allowed for DayScore.')
      } finally {
        setIsPushSubscribing(false)
      }
    } else {
      try {
        await unsubscribePushNotifications()
      } catch (e) {}
      const newSettings = { ...settings, notifications: false }
      setSettings(newSettings)
      await store.saveSettings(newSettings)
    }
  }

  const handleReminderChange = async (minutes) => {
    const minVal = Number(minutes)
    const newSettings = { ...settings, reminderLeadTime: minVal }
    setSettings(newSettings)
    await store.saveSettings(newSettings)
  }

  const handleTestNotification = async () => {
    if (testPushStatus === 'sending') return

    // 1. Check browser notification permission
    if (!('Notification' in window)) {
      alert('⚠️ Notifications are not supported by this browser.');
      return;
    }

    if (Notification.permission === 'denied') {
      alert(
        '⚠️ Notifications are BLOCKED for this site!\n\n' +
        'How to enable:\n' +
        '1. Click the Lock/Settings icon (🔒 or 🎚️) on the left side of your browser URL bar.\n' +
        '2. Change "Notifications" to "Allow".\n' +
        '3. Refresh the page and try again.'
      );
      return;
    }

    setTestPushStatus('sending');
    const rawMin = settings.reminderLeadTime ?? 30;
    const minutes = rawMin === 0 ? 10 : rawMin;
    const label = `${minutes} minutes before due time (with +1m early cron buffer)`;

    // 2. Play audio chime
    playNotificationSound();

    try {
      // 3. Ensure device is registered with Web Push
      try {
        await subscribeToPushNotifications();
      } catch (subErr) {
        console.warn('Push subscription note during test:', subErr);
      }

      // 4. Dispatch live Web Push from backend (delivered once via Service Worker)
      let pushDelivered = false;
      try {
        const pushRes = await dispatchTestPushNotification(minutes);
        if (pushRes && pushRes.sentCount > 0) {
          pushDelivered = true;
        }
      } catch (pushErr) {
        console.warn('Backend push dispatch note:', pushErr);
      }

      // 5. If server push was not delivered (e.g. offline/guest), trigger local notification fallback
      if (!pushDelivered) {
        await triggerDesktopNotification(
          '⏰ DayScore Task Reminders Active!',
          `Test notification successful!\nReminders scheduled ${label} (works even when app is closed).`
        );
      }

      setTestPushStatus('success');
      setTimeout(() => setTestPushStatus(''), 4000);
    } catch (err) {
      console.warn('Test notification note:', err);
      setTestPushStatus('done');
      setTimeout(() => setTestPushStatus(''), 3000);
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

  const handleOpenResetModal = () => {
    setResetConfirmText('')
    setShowResetModal(true)
  }

  const handleExecuteReset = async (e) => {
    if (e) e.preventDefault()
    if (resetConfirmText.trim() !== 'DELETE ALL DATA' || isResetting) return
    setIsResetting(true)
    try {
      await store.resetAllData()
      setShowResetModal(false)
      window.location.reload()
    } catch (err) {
      console.error('Reset error:', err)
      alert('Error during data reset: ' + (err.message || 'Unknown error'))
      setIsResetting(false)
    }
  }

  const Toggle = ({ active, onClick }) => (
    <button onClick={onClick} style={{ width: '44px', height: '24px', borderRadius: '12px', background: active ? 'var(--accent-primary)' : 'var(--bg-tertiary)', position: 'relative', border: '1px solid var(--border-glass)', cursor: 'pointer', transition: 'background 0.3s', flexShrink: 0 }}>
      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: active ? '22px' : '2px', transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )

  return (
    <div className="settings-view animate-slide-up">

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
                  <div className="settings-row-label">Task Reminders</div>
                  <div className="settings-row-sublabel">
                    {isPushSubscribing ? (
                      <span style={{ color: 'var(--accent-primary)' }}>Registering background push notification worker...</span>
                    ) : settings.notifications ? (
                      settings.reminderLeadTime === 0 ? 'Notifies 10 min before due time' : `Notifies ${settings.reminderLeadTime ?? 30} min before due time`
                    ) : (
                      'Notifications disabled'
                    )}
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
                      className={`segmented-option ${Number(settings.reminderLeadTime ?? 30) === opt.value ? 'active' : ''}`}
                      onClick={() => handleReminderChange(opt.value)}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    💡 Reminders are delivered to your device even when DayScore is closed.
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    onClick={handleTestNotification}
                    disabled={testPushStatus === 'sending'}
                    style={{ fontSize: '0.78rem', gap: '6px', padding: '6px 12px' }}
                  >
                    {testPushStatus === 'sending' ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Sending Push...</span>
                      </>
                    ) : testPushStatus === 'success' ? (
                      <>
                        <Check size={13} color="#22c55e" />
                        <span style={{ color: '#22c55e' }}>Push Sent to Device!</span>
                      </>
                    ) : (
                      <>
                        <span>🔔 Send Test Notification</span>
                      </>
                    )}
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
                  <div key={t.id} className="settings-template-card animate-slide-up" style={{ animationDelay: `${Math.min(idx * 0.04, 0.3)}s` }}>
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
              <button onClick={handleOpenResetModal} className="btn settings-reset-btn">
                <Trash2 size={15} /> Reset All Data
              </button>
            </div>
          </div>
        </>
      )}

      {/* Template Modal */}
      {showAddTemplate && createPortal(
        <div className="modal-overlay" onClick={() => !isSavingTemplate && setShowAddTemplate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingTemplate ? 'Edit Template' : 'New Template'}</h2>
              <button className="btn-icon" onClick={() => !isSavingTemplate && setShowAddTemplate(false)} disabled={isSavingTemplate}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveTemplate} className="modal-form-body">
              <div className="modal-form-scroll">
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
                  <button type="button" className="btn btn-secondary btn-sm" onClick={setTemplateEndOfDay} disabled={isSavingTemplate} style={{ fontSize: '0.72rem', padding: '3px 6px' }}>End of Day (11:59 PM)</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.35fr 0.8fr', gap: '6px', position: 'relative', overflow: 'visible' }}>
                  
                  {/* 1. Custom Glassmorphic Date Picker */}
                  <div style={{ position: 'static' }} ref={tDatePickerRef}>
                    <button
                      type="button"
                      disabled={isSavingTemplate}
                      onClick={() => {
                        setIsTDatePickerOpen(!isTDatePickerOpen)
                        setIsTHourPickerOpen(false)
                        setIsTMinutePickerOpen(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '9px 6px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-tertiary)',
                        border: isTDatePickerOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: isSavingTemplate ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        <CalendarIcon size={13} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{formatDisplayTDate(tDate)}</span>
                      </div>
                      <ChevronDown size={13} color="var(--text-muted)" style={{ transform: isTDatePickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                    </button>

                    {/* Calendar Popover */}
                    {isTDatePickerOpen && (
                      <div
                        className="animate-pop-in date-picker-popover card-glass"
                        style={{
                          position: 'absolute',
                          bottom: 'calc(100% + 8px)',
                          left: 0,
                          zIndex: 99999,
                          width: '270px',
                          padding: '14px',
                          borderRadius: '16px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-glass)',
                          boxShadow: 'var(--shadow-lg)',
                          backdropFilter: 'blur(20px)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          {(() => {
                            const isPrevDisabled = format(tCalendarViewDate, 'yyyy-MM') <= format(new Date(), 'yyyy-MM');
                            return (
                              <button
                                type="button"
                                disabled={isPrevDisabled}
                                onClick={() => !isPrevDisabled && setTCalendarViewDate(subMonths(tCalendarViewDate, 1))}
                                style={{
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-glass)',
                                  background: 'var(--bg-glass-light)',
                                  color: 'var(--text-primary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: isPrevDisabled ? 'not-allowed' : 'pointer',
                                  opacity: isPrevDisabled ? 0.3 : 1
                                }}
                              >
                                <ChevronLeft size={14} />
                              </button>
                            );
                          })()}
                          <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                            {format(tCalendarViewDate, 'MMMM yyyy')}
                          </strong>
                          <button type="button" onClick={() => setTCalendarViewDate(addMonths(tCalendarViewDate, 1))} style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass-light)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <ChevronRight size={14} />
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center', marginBottom: '6px' }}>
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                            <span key={d} style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{d}</span>
                          ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
                          {Array.from({ length: tStartDayOffset }).map((_, i) => <div key={`empty_${i}`} />)}
                          {tDaysInMonth.map((dayObj) => {
                            const dStr = format(dayObj, 'yyyy-MM-dd');
                            const isPast = dStr < todayDateStr;
                            const isSel = dStr === tDate;
                            const isTod = dStr === todayDateStr;

                            return (
                              <button
                                key={dStr}
                                type="button"
                                disabled={isPast}
                                onClick={() => {
                                  if (!isPast) {
                                    setTDate(dStr);
                                    setIsTDatePickerOpen(false);
                                  }
                                }}
                                style={{
                                  height: '30px',
                                  borderRadius: '6px',
                                  border: isSel ? '1px solid var(--accent-primary)' : '1px solid transparent',
                                  background: isSel ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : (isTod ? 'rgba(99, 102, 241, 0.18)' : 'var(--bg-glass-light)'),
                                  color: isSel ? '#ffffff' : (isPast ? 'var(--text-muted)' : 'var(--text-primary)'),
                                  opacity: isPast ? 0.3 : 1,
                                  cursor: isPast ? 'not-allowed' : 'pointer',
                                  fontSize: '0.8rem',
                                  fontWeight: isSel || isTod ? 700 : 500
                                }}
                              >
                                {format(dayObj, 'd')}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Custom Glassmorphic Hour Picker */}
                  <div style={{ position: 'relative' }} ref={tHourPickerRef}>
                    <button
                      type="button"
                      disabled={isSavingTemplate}
                      onClick={() => {
                        setIsTHourPickerOpen(!isTHourPickerOpen)
                        setIsTDatePickerOpen(false)
                        setIsTMinutePickerOpen(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '9px 6px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-secondary)',
                        border: isTHourPickerOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: isSavingTemplate ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                        <Clock size={13} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap' }}>
                          {String(tHour % 12 === 0 ? 12 : tHour % 12).padStart(2, '0')}:00 {tHour >= 12 ? 'PM' : 'AM'}
                        </span>
                      </div>
                      <ChevronDown size={13} color="var(--text-muted)" style={{ transform: isTHourPickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                    </button>

                    {/* Hour Popover */}
                    {isTHourPickerOpen && (
                      <div
                        className="animate-pop-in glass-popover-time card-glass"
                        style={{
                          position: 'absolute',
                          bottom: 'calc(100% + 8px)',
                          left: 0,
                          right: 0,
                          zIndex: 99999,
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: '12px',
                          padding: '6px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          boxShadow: 'var(--shadow-lg)',
                          backdropFilter: 'blur(20px)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px'
                        }}
                      >
                        {Array.from({ length: 24 }).map((_, h) => {
                          const isPast = isSelectedToday && h < currentHour;
                          if (isPast) return null;
                          const ampm = h >= 12 ? 'PM' : 'AM';
                          const displayH = h % 12 === 0 ? 12 : h % 12;
                          const isSel = h === tHour;

                          return (
                            <div
                              key={h}
                              onClick={() => {
                                setTHour(h);
                                setIsTHourPickerOpen(false);
                              }}
                              style={{
                                padding: '7px 10px',
                                borderRadius: '6px',
                                background: isSel ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'var(--bg-glass-light)',
                                color: isSel ? '#ffffff' : 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                fontWeight: isSel ? 700 : 500,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}
                            >
                              <span>{String(displayH).padStart(2, '0')}:00 {ampm}</span>
                              {isSel && <Check size={14} color="#ffffff" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 3. Custom Glassmorphic Minute Picker */}
                  <div style={{ position: 'relative' }} ref={tMinutePickerRef}>
                    <button
                      type="button"
                      disabled={isSavingTemplate}
                      onClick={() => {
                        setIsTMinutePickerOpen(!isTMinutePickerOpen)
                        setIsTDatePickerOpen(false)
                        setIsTHourPickerOpen(false)
                      }}
                      style={{
                        width: '100%',
                        padding: '9px 10px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-secondary)',
                        border: isTMinutePickerOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-glass)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: isSavingTemplate ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <span>:{String(tMinute).padStart(2, '0')}</span>
                      <ChevronDown size={14} color="var(--text-muted)" style={{ transform: isTMinutePickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>

                    {/* Minute Popover */}
                    {isTMinutePickerOpen && (
                      <div
                        className="animate-pop-in glass-popover-time card-glass"
                        style={{
                          position: 'absolute',
                          bottom: 'calc(100% + 8px)',
                          left: 0,
                          right: 0,
                          zIndex: 99999,
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: '12px',
                          padding: '6px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          boxShadow: 'var(--shadow-lg)',
                          backdropFilter: 'blur(20px)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px'
                        }}
                      >
                        {Array.from({ length: 60 }).map((_, m) => {
                          const isPast = isSelectedToday && tHour === currentHour && m < currentMinute;
                          if (isPast) return null;
                          const isSel = m === tMinute;

                          return (
                            <div
                              key={m}
                              onClick={() => {
                                setTMinute(m);
                                setIsTMinutePickerOpen(false);
                              }}
                              style={{
                                padding: '7px 10px',
                                borderRadius: '6px',
                                background: isSel ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'var(--bg-glass-light)',
                                color: isSel ? '#ffffff' : 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                fontWeight: isSel ? 700 : 500,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}
                            >
                              <span>:{String(m).padStart(2, '0')}</span>
                              {isSel && <Check size={14} color="#ffffff" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
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
        </div>,
        document.body
      )}

      {/* Danger Zone Permanent Reset Modal */}
      {showResetModal && createPortal(
        <div className="modal-overlay" onClick={() => !isResetting && setShowResetModal(false)}>
          <div className="modal-content danger-zone-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', border: '1px solid rgba(239, 68, 68, 0.45)', boxShadow: '0 20px 50px rgba(239, 68, 68, 0.15)' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 className="modal-title" style={{ color: '#ef4444', fontSize: '1.15rem', fontWeight: '700' }}>Danger Zone: Permanent Reset</h2>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Irreversible workspace and cloud deletion</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => !isResetting && setShowResetModal(false)} disabled={isResetting}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-form-body" style={{ paddingTop: '16px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#fca5a5', fontWeight: '600' }}>
                  🚨 Warning: This action cannot be undone!
                </p>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>• <strong>Tasks & Scores:</strong> All active tasks, carried-over items, daily notes & score logs will be purged.</div>
                  <div>• <strong>Streaks & Rewards:</strong> All streak records and claimed milestone rewards will be reset to 0.</div>
                  <div>• <strong>Templates & Reflections:</strong> All custom templates and daily reflections will be deleted.</div>
                  <div>• <strong>Cloud Account:</strong> Your cloud records stored on MongoDB Atlas will be permanently cleared.</div>
                </div>
              </div>

              {/* Safety Backup Option */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '18px' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>Need a safety backup first?</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Save a full snapshot file before deleting</div>
                </div>
                <button type="button" onClick={handleExport} className="btn btn-secondary btn-sm" style={{ fontSize: '0.78rem', gap: '6px' }}>
                  <Download size={14} /> Download Backup
                </button>
              </div>

              {/* Typed Verification Requirement */}
              <form onSubmit={handleExecuteReset}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label" style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    To confirm deletion, type <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>DELETE ALL DATA</span> below:
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={resetConfirmText}
                    onChange={e => setResetConfirmText(e.target.value)}
                    placeholder="Type DELETE ALL DATA to unlock"
                    autoFocus
                    disabled={isResetting}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      letterSpacing: '0.5px',
                      borderColor: resetConfirmText.trim() === 'DELETE ALL DATA' ? '#ef4444' : 'var(--border-glass)',
                      background: resetConfirmText.trim() === 'DELETE ALL DATA' ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-tertiary)'
                    }}
                  />
                </div>

                <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-glass)', paddingTop: '14px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowResetModal(false)}
                    disabled={isResetting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn"
                    disabled={resetConfirmText.trim() !== 'DELETE ALL DATA' || isResetting}
                    style={{
                      background: resetConfirmText.trim() === 'DELETE ALL DATA' ? '#ef4444' : 'rgba(239, 68, 68, 0.25)',
                      color: 'white',
                      border: '1px solid #ef4444',
                      opacity: resetConfirmText.trim() === 'DELETE ALL DATA' ? 1 : 0.45,
                      cursor: resetConfirmText.trim() === 'DELETE ALL DATA' ? 'pointer' : 'not-allowed',
                      gap: '8px',
                      fontWeight: '600',
                      transition: 'all 0.2s ease',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                  >
                    {isResetting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Erasing Everything...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={16} />
                        <span>Permanently Delete All Data</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
