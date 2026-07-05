const CHECK_INTERVAL = 5 * 60 * 1000;
const VERSION_URL = '/version.json';

let lastBuildTime: number | null = null;
let overlayEl: HTMLDivElement | null = null;

function showUpdatingOverlay() {
  if (overlayEl) return;
  overlayEl = document.createElement('div');
  overlayEl.id = 'sgi-update-overlay';
  overlayEl.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:Arial,sans-serif;';
  overlayEl.innerHTML = '<div style="width:40px;height:40px;border:4px solid #3b82f6;border-top-color:transparent;border-radius:50%;animation:spin .8s linear infinite;margin-bottom:16px;"></div><p style="font-size:18px;font-weight:700;">Atualizando...</p><p style="font-size:13px;color:#94a3b8;margin-top:4px;">nova versão disponível</p><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
  document.body.appendChild(overlayEl);
}

function reloadApp() {
  showUpdatingOverlay();
  setTimeout(() => window.location.reload(), 500);
}

async function checkVersionJson() {
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.buildTime && lastBuildTime && data.buildTime !== lastBuildTime) {
      reloadApp();
    }
  } catch {
    // ignore
  }
}

function setupPeriodicVersionCheck() {
  fetch(VERSION_URL, { cache: 'no-store' })
    .then((r) => r.json())
    .then((data) => { lastBuildTime = data?.buildTime ?? null; })
    .catch(() => {});
  setInterval(checkVersionJson, CHECK_INTERVAL);
}

function setupSWUpdates() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((reg) => {
    setInterval(() => { reg.update().catch(() => {}); }, CHECK_INTERVAL);

    const onUpdate = () => {
      const newSW = reg.installing || reg.waiting;
      if (!newSW || !navigator.serviceWorker.controller) return;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed') {
          newSW.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    };

    if (reg.installing) onUpdate();
    reg.addEventListener('updatefound', onUpdate);
  }).catch(() => {});

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'RELOAD') reloadApp();
  });
}

export function initVersionCheck() {
  setupSWUpdates();
  setupPeriodicVersionCheck();
}
