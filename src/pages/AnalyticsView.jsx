import { useState, useEffect, useMemo } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import CalendarHeatmap from '../components/CalendarHeatmap'
import StatsCards from '../components/StatsCards'
import * as store from '../store/store'
import * as scoring from '../store/scoring'
import { format, subDays } from 'date-fns'
import { useAuth } from '../context/AuthContext'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, Filler
)

export default function AnalyticsView() {
  const { user } = useAuth()
  const [archives, setArchives] = useState([])
  const [todayTasks, setTodayTasks] = useState([])
  const [themeTextColor, setThemeTextColor] = useState('#e0e0e0')
  const [gridColor, setGridColor] = useState('rgba(128,128,128,0.12)')

  useEffect(() => {
    let isMounted = true;
    const loadAnalyticsData = async () => {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const loadedArchives = await store.fetchArchivesApi()
      if (!isMounted) return;
      setArchives(loadedArchives)

      const loadedTasks = await store.fetchTasksApi(todayStr)
      if (!isMounted) return;
      setTodayTasks(loadedTasks)
    }

    loadAnalyticsData()

    const updateColors = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
      setThemeTextColor(isDark ? 'rgba(224,224,224,0.7)' : 'rgba(51,51,51,0.7)')
      setGridColor(isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')
    }
    updateColors()

    const observer = new MutationObserver(() => updateColors())
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      isMounted = false;
      observer.disconnect()
    }
  }, [user])

  const mergedArchives = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const map = new Map()
    archives.forEach(a => map.set(a.date, a))

    if (todayTasks.length > 0 && todayTasks.some(t => t.status === 'done')) {
      const todayResult = scoring.calculateDailyScore(todayTasks)
      map.set(todayStr, {
        date: todayStr,
        score: todayResult.score,
        tasks: todayTasks
      })
    }
    return Array.from(map.values())
  }, [archives, todayTasks])

  const streakData = useMemo(() => scoring.getStreak(mergedArchives, todayTasks), [mergedArchives, todayTasks])
  const bestStreak = useMemo(() => scoring.getBestStreak(mergedArchives, todayTasks), [mergedArchives, todayTasks])
  const avgScore = useMemo(() => scoring.getRollingAverage(mergedArchives, 0, todayTasks), [mergedArchives, todayTasks])
  const totalDone = useMemo(() => scoring.getTotalTasksDone(mergedArchives), [mergedArchives])
  const bestCategory = useMemo(() => scoring.getMostProductiveCategory(mergedArchives), [mergedArchives])
  const missedTime = useMemo(() => scoring.getMostMissedTimeOfDay(mergedArchives), [mergedArchives])

  const lineChartData = useMemo(() => {
    const last30 = []
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const dStr = format(subDays(today, i), 'yyyy-MM-dd')
      const label = format(subDays(today, i), 'dd')
      const arc = mergedArchives.find(a => a.date === dStr)
      last30.push({ label, score: arc ? (arc.score || 0) : 0 })
    }

    return {
      labels: last30.map(d => d.label),
      datasets: [{
        label: 'Daily Score',
        data: last30.map(d => d.score),
        borderColor: '#818cf8',
        backgroundColor: 'rgba(129, 140, 248, 0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
        pointBackgroundColor: '#818cf8',
        pointBorderColor: '#818cf8',
        borderWidth: 2,
      }]
    }
  }, [mergedArchives])

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    scales: {
      y: { min: 0, max: 10, ticks: { color: themeTextColor, stepSize: 2, font: { size: 11 } }, grid: { color: gridColor } },
      x: { ticks: { color: themeTextColor, maxTicksLimit: 15, font: { size: 10 } }, grid: { display: false } }
    },
    plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', titleFont: { size: 12 }, bodyFont: { size: 12 }, cornerRadius: 8, padding: 10 } }
  }

  const barChartData = useMemo(() => {
    const cats = { 'Work': 0, 'Learning': 0, 'Health': 0, 'Personal': 0 }
    mergedArchives.forEach(arc => {
      if (arc.tasks) arc.tasks.forEach(t => { if (t.status === 'done' && cats[t.category] !== undefined) cats[t.category]++ })
    })

    return {
      labels: Object.keys(cats),
      datasets: [{
        label: 'Completed',
        data: Object.values(cats),
        backgroundColor: ['rgba(129,140,248,0.65)', 'rgba(167,139,250,0.65)', 'rgba(52,211,153,0.65)', 'rgba(251,191,36,0.65)'],
        borderColor: ['#818cf8', '#a78bfa', '#34d399', '#fbbf24'],
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }]
    }
  }, [mergedArchives])

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { color: themeTextColor, stepSize: 1, font: { size: 11 } }, grid: { color: gridColor } },
      x: { ticks: { color: themeTextColor, font: { size: 12 } }, grid: { display: false } }
    }
  }

  return (
    <div className="analytics-view">
      <h1 className="analytics-title">📊 Analytics</h1>
      
      <StatsCards 
        currentStreak={streakData.current}
        bestStreak={bestStreak}
        avgScore={avgScore}
        totalDone={totalDone}
        bestCategory={bestCategory}
        missedTime={missedTime}
      />

      <div className="card-glass analytics-heatmap-card">
        <h2 className="analytics-card-title">Activity Heatmap</h2>
        <CalendarHeatmap archives={mergedArchives} />
      </div>

      <div className="analytics-charts-grid">
        <div className="card-glass">
          <h2 className="analytics-card-title">30-Day Score Trend</h2>
          <div className="analytics-chart-wrapper">
            <Line data={lineChartData} options={lineOptions} />
          </div>
        </div>

        <div className="card-glass">
          <h2 className="analytics-card-title">Tasks by Category</h2>
          <div className="analytics-chart-wrapper">
            <Bar data={barChartData} options={barOptions} />
          </div>
        </div>
      </div>
    </div>
  )
}
