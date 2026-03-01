/**
 * SGI FV - Main Entry Point
 * Ultra-early logging enabled for debugging
 */

// ============================================
// ULTRA-EARLY CONSOLE TEST
// ============================================
console.log('='.repeat(60));
console.log('[MAIN] 🚀 CONSOLE TEST - If you see this, console works!');
console.log('[MAIN] Timestamp:', new Date().toISOString());
console.log('='.repeat(60));

// Check if console is overridden
if (typeof console.log !== 'function') {
  document.body.innerHTML = '<h1 style="color:red;padding:20px;">ERROR: Console.log is not a function!</h1>';
}

// ============================================
// GLOBAL ERROR HANDLERS
// ============================================
window.onerror = function(message, source, lineno, colno, error) {
  console.error('[GLOBAL ERROR] ❌', {
    message,
    source,
    lineno,
    colno,
    error: error?.stack || error?.toString()
  });
  
  // Display error on screen if React hasn't loaded
  const rootEl = document.getElementById('root');
  if (rootEl && !rootEl.hasChildNodes()) {
    rootEl.innerHTML = `
      <div style="padding:20px;color:white;background:#0f172a;min-height:100vh;font-family:Arial">
        <h1 style="color:#ef4444">❌ JavaScript Error</h1>
        <pre style="color:#fca5a5;background:#1e293b;padding:15px;border-radius:8px;white-space:pre-wrap">
Message: ${message}
Source: ${source}
Line: ${lineno}, Column: ${colno}
Error: ${error?.stack || error?.toString() || 'Unknown'}
        </pre>
      </div>
    `;
  }
  return false;
};

window.onunhandledrejection = function(event) {
  console.error('[UNHANDLED REJECTION] ❌', {
    reason: event.reason,
    message: event.reason?.message,
    stack: event.reason?.stack
  });
};

console.log('[MAIN] ✅ Global error handlers installed');

// ============================================
// IMPORTS WITH LOGGING
// ============================================
console.log('[MAIN] Starting imports...');

let React: any;
let ReactDOM: any;
let App: any;
let ErrorBoundary: any;

try {
  console.log('[MAIN] Importing React...');
  React = await import('react');
  console.log('[MAIN] ✅ React imported, version:', React.version);
  
  console.log('[MAIN] Importing ReactDOM...');
  ReactDOM = await import('react-dom/client');
  console.log('[MAIN] ✅ ReactDOM imported');
  
  console.log('[MAIN] Importing ErrorBoundary...');
  ErrorBoundary = (await import('./src/components/ErrorBoundary')).default;
  console.log('[MAIN] ✅ ErrorBoundary imported');
  
  console.log('[MAIN] Importing App...');
  App = (await import('./App')).default;
  console.log('[MAIN] ✅ App imported');
  
} catch (importError: any) {
  console.error('[MAIN] ❌ Import failed:', importError);
  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.innerHTML = `
      <div style="padding:20px;color:white;background:#0f172a;min-height:100vh;font-family:Arial">
        <h1 style="color:#ef4444">❌ Import Error</h1>
        <pre style="color:#fca5a5;background:#1e293b;padding:15px;border-radius:8px;white-space:pre-wrap">
${importError?.message || importError}
${importError?.stack || ''}
        </pre>
      </div>
    `;
  }
  throw importError;
}

// ============================================
// RENDER APPLICATION
// ============================================
console.log('[MAIN] All imports successful, starting render...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[MAIN] ❌ Could not find root element!');
  throw new Error("Could not find root element to mount to");
}

console.log('[MAIN] Root element found, creating React root...');

try {
  const root = ReactDOM.createRoot(rootElement);
  console.log('[MAIN] ✅ React root created');
  
  console.log('[MAIN] Calling root.render()...');
  root.render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(
        ErrorBoundary,
        null,
        React.createElement(App)
      )
    )
  );
  
  console.log('[MAIN] ✅ root.render() called successfully');
  console.log('[MAIN] 🎉 Application render initiated!');
  console.log('='.repeat(60));
  
} catch (renderError: any) {
  console.error('[MAIN] ❌ Render failed:', renderError);
  rootElement.innerHTML = `
    <div style="padding:20px;color:white;background:#0f172a;min-height:100vh;font-family:Arial">
      <h1 style="color:#ef4444">❌ Render Error</h1>
      <pre style="color:#fca5a5;background:#1e293b;padding:15px;border-radius:8px;white-space:pre-wrap">
${renderError?.message || renderError}
${renderError?.stack || ''}
      </pre>
    </div>
  `;
  throw renderError;
}
