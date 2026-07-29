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
import { format, subDays, parseISO } from 'date-fns'
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

      const computedArchives = store.getArchivesFromTasks()
      setArchives(computedArchives)

      const cachedTasks = store.getTasks(todayStr)
      if (cachedTasks && cachedTasks.length > 0) {
        setTodayTasks(cachedTasks)
      }

      // Fetch ALL user tasks across dates from MongoDB Atlas
      const allArchives = await store.fetchAllTasksApi()
      if (!isMounted) return;
      setArchives(allArchives)
      setTodayTasks(store.getTasks(todayStr))
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
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const map = new Map();
    const safeArchives = Array.isArray(archives) ? archives : [];
    const safeTodayTasks = Array.isArray(todayTasks) ? todayTasks : [];

    // 1. Process all archives
    safeArchives.forEach(a => {
      if (a && a.date) {
        const cleanDate = a.date.includes('T') ? a.date.split('T')[0] : a.date.trim().substring(0, 10);
        const taskList = Array.isArray(a.tasks) ? a.tasks : [];
        const res = taskList.length > 0 ? scoring.calculateDailyScore(taskList) : { score: Number(a.score || 0) };
        const hasDone = taskList.some(t => t && (t.status === 'done' || t.completedAt || t.completed_at)) || Boolean(a.hasDone);

        map.set(cleanDate, {
          ...a,
          date: cleanDate,
          score: Math.max(res.score, Number(a.score || 0)),
          tasks: taskList,
          hasTasks: taskList.length > 0,
          hasDone
        });
      }
    });

    // 2. Ensure today's date is updated with safeTodayTasks
    if (safeTodayTasks.length > 0 || !map.has(todayStr)) {
      const existing = map.get(todayStr) || {};
      const res = scoring.calculateDailyScore(safeTodayTasks);
      const hasDone = safeTodayTasks.some(t => t && (t.status === 'done' || t.completedAt || t.completed_at));
      map.set(todayStr, {
        ...existing,
        date: todayStr,
        score: Math.max(res.score, Number(existing.score || 0)),
        tasks: safeTodayTasks,
        hasTasks: safeTodayTasks.length > 0,
        hasDone: hasDone || Boolean(existing.hasDone)
      });
    }

    return Array.from(map.values()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [archives, todayTasks]);

  const streakData = useMemo(() => scoring.getStreak(mergedArchives, todayTasks), [mergedArchives, todayTasks])
  const bestStreak = useMemo(() => scoring.getBestStreak(mergedArchives, todayTasks), [mergedArchives, todayTasks])
  const avgScore = useMemo(() => scoring.getRollingAverage(mergedArchives, 0, todayTasks), [mergedArchives, todayTasks])
  const totalDone = useMemo(() => scoring.getTotalTasksDone(mergedArchives), [mergedArchives])
  const bestCategory = useMemo(() => scoring.getMostProductiveCategory(mergedArchives, todayTasks), [mergedArchives, todayTasks]);
  const missedTime = useMemo(() => scoring.getMostMissedTimeOfDay(mergedArchives), [mergedArchives]);

  const lineChartData = useMemo(() => {
    const last30 = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const dDate = subDays(today, i);
      const dStr = format(dDate, 'yyyy-MM-dd');
      const label = format(dDate, 'MMM dd');
      const arc = mergedArchives.find(a => a.date === dStr);

      const score = (arc && arc.hasTasks && arc.score > 0) ? arc.score : (arc && arc.score > 0 ? arc.score : null);
      last30.push({ label, score, dateStr: dStr });
    }

    return {
      labels: last30.map(d => d.label),
      datasets: [{
        label: 'Daily Score',
        data: last30.map(d => d.score),
        borderColor: '#818cf8',
        backgroundColor: 'rgba(129, 140, 248, 0.15)',
        fill: true,
        tension: 0.35,
        spanGaps: true,
        pointRadius: last30.map(d => d.score !== null ? 6 : 0),
        pointHoverRadius: 8,
        pointBackgroundColor: '#818cf8',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        borderWidth: 3,
      }]
    };
  }, [mergedArchives]);

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: 10,
        right: 25,
        top: 25,
        bottom: 10
      }
    },
    interaction: { intersect: false, mode: 'index' },
    scales: {
      y: {
        min: 0,
        max: 11,
        ticks: {
          color: themeTextColor,
          stepSize: 2,
          font: { size: 11, weight: '600' },
          callback: (val) => (val > 10 ? '' : val)
        },
        grid: { color: gridColor }
      },
      x: {
        ticks: {
          color: themeTextColor,
          maxTicksLimit: 8,
          maxRotation: 0,
          font: { size: 10, weight: '500' }
        },
        grid: { display: false }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleFont: { size: 12, weight: '700' },
        bodyFont: { size: 13, weight: '600' },
        cornerRadius: 8,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (context) => `Daily Score: ${context.raw !== null ? `${context.raw}/10` : 'No activity'}`
        }
      }
    }
  };

  const barChartData = useMemo(() => {
    const cats = scoring.getCategoryCounts(mergedArchives, todayTasks);
    const labels = Object.keys(cats);
    const values = Object.values(cats);

    const palette = [
      { bg: 'rgba(129, 140, 248, 0.65)', border: '#818cf8' },
      { bg: 'rgba(167, 139, 250, 0.65)', border: '#a78bfa' },
      { bg: 'rgba(52, 211, 153, 0.65)', border: '#34d399' },
      { bg: 'rgba(251, 191, 36, 0.65)', border: '#fbbf24' },
      { bg: 'rgba(248, 113, 113, 0.65)', border: '#f87171' },
      { bg: 'rgba(56, 189, 248, 0.65)', border: '#38bdf8' }
    ];

    return {
      labels,
      datasets: [{
        label: 'Tasks',
        data: values,
        backgroundColor: labels.map((_, i) => palette[i % palette.length].bg),
        borderColor: labels.map((_, i) => palette[i % palette.length].border),
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }]
    };
  }, [mergedArchives, todayTasks]);

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { color: themeTextColor, stepSize: 1, font: { size: 11 } }, grid: { color: gridColor } },
      x: { ticks: { color: themeTextColor, font: { size: 12 } }, grid: { display: false } }
    }
  };

  return (
    <div className="analytics-view animate-slide-up">
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
  );
}
