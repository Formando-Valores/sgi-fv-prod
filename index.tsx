/**
 * SGI FV - Main Entry Point
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary from './src/components/ErrorBoundary';
import App from './App';

// ============================================
// GLOBAL ERROR HANDLERS
// ============================================
window.onerror = function(message, source, lineno, colno, error) {
  console.error('[GLOBAL ERROR]', { message, source, lineno, colno, error: error?.stack || error?.toString() });
  const rootEl = document.getElementById('root');
  if (rootEl && !rootEl.hasChildNodes()) {
    rootEl.innerHTML = `
      <div style="padding:20px;color:white;background:#0f172a;min-height:100vh;font-family:Arial">
        <h1 style="color:#ef4444">❌ JavaScript Error</h1>
        <pre style="color:#fca5a5;background:#1e293b;padding:15px;border-radius:8px;white-space:pre-wrap">
Message: ${message}
Source: ${source}
Line: ${lineno}, Column: ${colno}
        </pre>
      </div>
    `;
  }
  return false;
};

window.onunhandledrejection = function(event) {
  console.error('[UNHANDLED REJECTION]', { reason: event.reason?.message || event.reason });
};

// ============================================
// RENDER APPLICATION
// ============================================
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
