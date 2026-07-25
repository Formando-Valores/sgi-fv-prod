/**
 * SGI FV - Main Entry Point
 */

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

const normalizeRecoveryCallbackUrl = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const hashRaw = window.location.hash.replace(/^#/, '');
  const hashQuery = hashRaw.includes('?') ? hashRaw.split('?').slice(1).join('?') : hashRaw;
  const hashParams = new URLSearchParams(hashQuery);
  const recoveryParams = new URLSearchParams();

  ['code', 'type', 'token', 'email', 'token_hash', 'access_token', 'refresh_token', 'error', 'error_description'].forEach((key) => {
    const fromSearch = searchParams.get(key);
    const fromHash = hashParams.get(key);

    if (fromSearch) {
      recoveryParams.set(key, fromSearch);
      return;
    }

    if (fromHash) {
      recoveryParams.set(key, fromHash);
    }
  });

  const hasRecoverySignal =
    recoveryParams.get('type') === 'recovery' ||
    (recoveryParams.has('token') && recoveryParams.has('email')) ||
    recoveryParams.has('token_hash') ||
    recoveryParams.has('access_token') ||
    recoveryParams.has('refresh_token') ||
    recoveryParams.has('code');

  if (!hasRecoverySignal) {
    return;
  }

  const targetHash = `/recovery${recoveryParams.toString() ? `?${recoveryParams.toString()}` : ''}`;

  if (window.location.hash === `#${targetHash}`) {
    return;
  }

  window.location.replace(`${window.location.origin}${window.location.pathname}#${targetHash}`);
};

normalizeRecoveryCallbackUrl();

const renderImportError = (importError: any) => {
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
};

const renderRuntimeError = (renderError: any) => {
  console.error('[MAIN] ❌ Render failed:', renderError);
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  rootElement.innerHTML = `
    <div style="padding:20px;color:white;background:#0f172a;min-height:100vh;font-family:Arial">
      <h1 style="color:#ef4444">❌ Render Error</h1>
      <pre style="color:#fca5a5;background:#1e293b;padding:15px;border-radius:8px;white-space:pre-wrap">
${renderError?.message || renderError}
${renderError?.stack || ''}
      </pre>
    </div>
  `;
};

async function bootstrap() {
  let React: any;
  let ReactDOM: any;
  let App: any;
  let ErrorBoundary: any;

  try {
    React = await import('react');
    ReactDOM = await import('react-dom/client');
    ErrorBoundary = (await import('./src/components/ErrorBoundary')).default;
    App = (await import('./App')).default;
  } catch (importError: any) {
    renderImportError(importError);
    throw importError;
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Could not find root element to mount to');
  }

  try {
    const root = ReactDOM.createRoot(rootElement);
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

    const { initVersionCheck } = await import('./src/lib/version-check');
    initVersionCheck();
  } catch (renderError: any) {
    renderRuntimeError(renderError);
    throw renderError;
  }
}

void bootstrap();
