import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import './index.css';
import { AuthProvider } from './services/auth/AuthContext.jsx';

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      const msg = String(this.state.error?.message || this.state.error || 'ERROR');
      return (
        <div style={{ minHeight: '100vh', background: '#05070c', color: '#e5e7eb', padding: 24, fontFamily: 'system-ui' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Trang bị lỗi và bị trắng</div>
            <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>
              Mở DevTools (F12) → Console để xem chi tiết. Lỗi:
            </div>
            <pre
              style={{
                marginTop: 12,
                background: 'rgba(255,255,255,0.06)',
                padding: 12,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {msg}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </RootErrorBoundary>
  </React.StrictMode>
);

