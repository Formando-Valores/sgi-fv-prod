import { createClient } from '@supabase/supabase-js';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Elemento #app não encontrado na página de recuperação.');
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const loginUrl = `${window.location.origin}/#/login`;

const render = (content: string) => {
  app.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(180deg,#0f172a 0%,#020617 100%);color:#fff;font-family:Arial,sans-serif;">
      <div style="width:100%;max-width:460px;background:#1e293b;border:1px solid #334155;border-radius:24px;padding:32px;box-shadow:0 30px 80px rgba(15,23,42,.45);">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="margin:0;font-size:28px;font-weight:800;letter-spacing:.04em;">Formando Valores</h1>
          <p style="margin:8px 0 0;color:#94a3b8;font-size:12px;font-weight:700;text-transform:uppercase;">Redefinição de senha</p>
        </div>
        ${content}
      </div>
    </div>
  `;
};

if (!supabaseUrl || !supabaseAnonKey) {
  render(`
    <p style="margin:0 0 16px;color:#fca5a5;font-weight:700;">Não foi possível iniciar a redefinição de senha.</p>
    <p style="margin:0;color:#cbd5e1;">As variáveis de ambiente do Supabase não estão configuradas neste ambiente.</p>
  `);
  throw new Error('VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

render(`
  <form id="reset-form" style="display:flex;flex-direction:column;gap:16px;">
    <p style="margin:0;color:#cbd5e1;line-height:1.6;">Defina uma nova senha para concluir o acesso à sua conta.</p>
    <label style="display:flex;flex-direction:column;gap:8px;">
      <span style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;">Nova senha</span>
      <input id="password" type="password" required minlength="8" placeholder="Digite sua nova senha" style="padding:14px 16px;border-radius:14px;border:1px solid #475569;background:#0f172a;color:#fff;font-weight:700;" />
    </label>
    <label style="display:flex;flex-direction:column;gap:8px;">
      <span style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;">Confirmar nova senha</span>
      <input id="confirm-password" type="password" required minlength="8" placeholder="Confirme sua nova senha" style="padding:14px 16px;border-radius:14px;border:1px solid #475569;background:#0f172a;color:#fff;font-weight:700;" />
    </label>
    <p id="feedback" style="margin:0;font-size:14px;font-weight:700;color:#cbd5e1;"></p>
    <button id="submit-button" type="submit" style="padding:14px 16px;border:0;border-radius:14px;background:#2563eb;color:#fff;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;">
      Atualizar senha
    </button>
    <a href="${loginUrl}" style="color:#93c5fd;font-weight:700;text-align:center;text-decoration:none;">Voltar para o login</a>
  </form>
`);

const form = document.querySelector<HTMLFormElement>('#reset-form');
const passwordInput = document.querySelector<HTMLInputElement>('#password');
const confirmPasswordInput = document.querySelector<HTMLInputElement>('#confirm-password');
const submitButton = document.querySelector<HTMLButtonElement>('#submit-button');
const feedback = document.querySelector<HTMLParagraphElement>('#feedback');

if (!form || !passwordInput || !confirmPasswordInput || !submitButton || !feedback) {
  throw new Error('Não foi possível inicializar o formulário de redefinição de senha.');
}

const validatePassword = (value: string) => {
  const hasMinLength = value.length >= 8;
  const hasUpper = /[A-Z]/.test(value);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  return hasMinLength && hasUpper && hasSpecial && hasNumber;
};

const extractHashParams = () => {
  const hash = window.location.hash || '';
  const rawParams = hash.includes('#')
    ? hash.split('#').slice(1).find((segment) => segment.includes('access_token=') || segment.includes('code=')) ?? ''
    : '';

  return new URLSearchParams(rawParams);
};

const bootstrapRecoverySession = async () => {
  const hashParams = extractHashParams();
  const searchParams = new URLSearchParams(window.location.search);

  const accessToken = hashParams.get('access_token') ?? searchParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token') ?? searchParams.get('refresh_token');
  const code = hashParams.get('code') ?? searchParams.get('code');

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }

    return;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw error;
    }
    return;
  }

  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw new Error('Link de recuperação inválido ou expirado.');
  }
};

void bootstrapRecoverySession().catch((error) => {
  feedback.textContent = error instanceof Error ? error.message : 'Não foi possível validar o link de recuperação.';
  feedback.style.color = '#fca5a5';
  submitButton.disabled = true;
  submitButton.style.opacity = '0.6';
  submitButton.style.cursor = 'not-allowed';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  feedback.textContent = '';
  feedback.style.color = '#fca5a5';

  if (password !== confirmPassword) {
    feedback.textContent = 'As senhas não coincidem.';
    return;
  }

  if (!validatePassword(password)) {
    feedback.textContent = 'A senha deve ter 8 caracteres, uma letra maiúscula, um caractere especial e um número.';
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Atualizando...';

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    feedback.textContent = error.message || 'Não foi possível redefinir a senha.';
    submitButton.disabled = false;
    submitButton.textContent = 'Atualizar senha';
    return;
  }

  await supabase.auth.signOut();

  feedback.textContent = 'Senha redefinida com sucesso. Você já pode voltar ao login.';
  feedback.style.color = '#86efac';
  submitButton.textContent = 'Senha atualizada';
  form.reset();
});
