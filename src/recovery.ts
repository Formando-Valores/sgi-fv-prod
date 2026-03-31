const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Elemento #app não encontrado na página de recuperação.');
}

const render = (content: string) => {
  app.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#ffffff;color:#1e293b;font-family:Arial,sans-serif;">
      <div style="width:100%;max-width:460px;background:#ffffff;border:1px solid #cbd5e1;border-radius:24px;padding:32px;box-shadow:0 20px 50px rgba(15,23,42,.10);">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="margin:0;font-size:38px;font-weight:800;color:#142c4c;letter-spacing:.04em;">SGI FV</h1>
          <p style="margin:8px 0 0;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;">Formando Valores</p>
        </div>
        ${content}
      </div>
    </div>
  `;
};

render(`
  <div style="display:flex;flex-direction:column;gap:16px;">
    <p style="margin:0;color:#334155;line-height:1.6;">Estamos validando seu link para abrir a tela de redefinição de senha...</p>
    <p id="feedback" style="margin:0;font-size:14px;font-weight:700;color:#2563eb;">Redirecionando...</p>
  </div>
`);

const feedback = document.querySelector<HTMLParagraphElement>('#feedback');

if (!feedback) {
  throw new Error('Não foi possível inicializar o redirecionamento de recuperação.');
}

const redirectToSpaRecovery = () => {
  const hash = window.location.hash.replace(/^#/, '').trim();
  const searchParams = new URLSearchParams(window.location.search);
  const tokenParams = new URLSearchParams();

  if (hash) {
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const code = hashParams.get('code');
    const type = hashParams.get('type');

    if (accessToken) tokenParams.set('access_token', accessToken);
    if (refreshToken) tokenParams.set('refresh_token', refreshToken);
    if (code) tokenParams.set('code', code);
    if (type) tokenParams.set('type', type);
  }

  ['code', 'type', 'access_token', 'refresh_token'].forEach((key) => {
    const value = searchParams.get(key);
    if (value && !tokenParams.has(key)) tokenParams.set(key, value);
  });

  const query = tokenParams.toString();
  const targetUrl = `${window.location.origin}/#/recovery${query ? `?${query}` : ''}`;

  if (window.location.href === targetUrl) return;

  window.location.replace(targetUrl);
};

try {
  redirectToSpaRecovery();
} catch (error) {
  feedback.textContent = error instanceof Error ? error.message : 'Não foi possível redirecionar para a tela de redefinição.';
  feedback.style.color = '#dc2626';
}
