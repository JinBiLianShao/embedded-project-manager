import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';

const container = document.getElementById('root');
const root = createRoot(container);

// 顶层错误边界：任何渲染异常都给出可见提示，而不是白屏
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('渲染异常', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
          <h2>界面出现异常</h2>
          <pre style={{ whiteSpace: 'pre-wrap', opacity: 0.8 }}>{String(this.state.error && this.state.error.message)}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '8px 16px' }}>
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

root.render(
  <ErrorBoundary>
    <App/>
  </ErrorBoundary>
);
