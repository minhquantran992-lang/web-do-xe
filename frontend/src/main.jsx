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
      return (
        <div style={{ minHeight: '100vh', background: '#05070c', color: '#e5e7eb', padding: 24, fontFamily: 'system-ui' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Ứng dụng gặp lỗi</div>
            <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>Vui lòng tải lại trang hoặc thử lại sau.</div>
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

