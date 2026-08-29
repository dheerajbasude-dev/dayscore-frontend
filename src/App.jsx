import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import Navigation from './components/Navigation'
import ScrollToTop from './components/ScrollToTop'
import TodayView from './pages/TodayView'
import AnalyticsView from './pages/AnalyticsView'
import RewardsView from './pages/RewardsView'
import SettingsView from './pages/SettingsView'

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <ScrollToTop />
              <div className="app-layout">
                <Navigation />
                <main className="main-content">
                  <Routes>
                    <Route path="/" element={<TodayView />} />
                    <Route path="/analytics" element={<AnalyticsView />} />
                    <Route path="/rewards" element={<RewardsView />} />
                    <Route path="/settings" element={<SettingsView />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App

