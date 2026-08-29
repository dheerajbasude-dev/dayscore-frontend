import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Uncaught Error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearCacheAndReload = () => {
    try {
      // Clear client storage in case corrupted data caused the crash
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Clear storage error:', e);
    }
    window.location.href = '/';
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || String(this.state.error || 'Unknown error');
      const errorStack = this.state.error?.stack || '';

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0a0a14',
          color: '#ffffff',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '20px',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#16162a',
            borderRadius: '16px',
            padding: '28px 20px',
            maxWidth: '440px',
            width: '100%',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            boxSizing: 'border-box'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              fontSize: '24px'
            }}>
              ⚠️
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '8px', color: '#f43f5e' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '20px', lineHeight: '1.5' }}>
              The application encountered an unexpected issue on this device. You can reload or reset the local cache.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  backgroundColor: '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  fontSize: '0.92rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'background-color 0.15s ease'
                }}
              >
                Reload App
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '11px 20px',
                  borderRadius: '10px',
                  fontSize: '0.86rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'all 0.15s ease'
                }}
              >
                Clear Cache & Reload
              </button>
            </div>

            {/* Collapsible Error Info for Debugging */}
            <div style={{ marginTop: '12px', textAlign: 'left' }}>
              <button
                type="button"
                onClick={this.toggleDetails}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: '4px 0',
                  textDecoration: 'underline',
                  display: 'block',
                  margin: '0 auto'
                }}
              >
                {this.state.showDetails ? 'Hide Error Details' : 'View Error Details'}
              </button>

              {this.state.showDetails && (
                <div style={{
                  marginTop: '8px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#0c0e18',
                  border: '1px solid rgba(244, 63, 94, 0.2)',
                  fontSize: '0.75rem',
                  color: '#fda4af',
                  fontFamily: 'monospace',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap'
                }}>
                  <strong>{errorMessage}</strong>
                  {errorStack && (
                    <div style={{ marginTop: '6px', color: '#94a3b8', fontSize: '0.7rem' }}>
                      {errorStack}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
