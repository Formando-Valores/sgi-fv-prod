export type AccessEmailPayload = {
  email: string;
  fullName?: string;
  loginUrl?: string;
  source?: string;
};

export type PasswordResetEmailPayload = {
  email: string;
  fullName?: string;
  loginUrl?: string;
  resetUrl: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getEmailConfig = () => {
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const from = Deno.env.get('FROM_EMAIL') ?? Deno.env.get('ACCESS_EMAIL_FROM') ?? '';
  const replyTo = Deno.env.get('ACCESS_EMAIL_REPLY_TO') ?? '';

  if (!resendApiKey || !from) {
    return null;
  }

  return { resendApiKey, from, replyTo };
};

export async function sendAccessCredentialsEmail(payload: AccessEmailPayload) {
  const emailConfig = getEmailConfig();

  if (!emailConfig) {
    return {
      ok: false,
      error: 'Serviço de e-mail não configurado. Defina RESEND_API_KEY e FROM_EMAIL.',
    };
  }

  const recipientName = payload.fullName?.trim() || 'cliente';
  const loginUrl = payload.loginUrl?.trim() || 'https://sgi-fv-prod.vercel.app/#/login';
  const sourceLabel = payload.source?.trim() || 'plataforma SGI FV';

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2>Seu acesso foi criado com sucesso</h2>
      <p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p>
      <p>Seu cadastro foi realizado com sucesso na <strong>${escapeHtml(sourceLabel)}</strong>.</p>
      <div style="padding:16px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;margin:16px 0;">
        <p style="margin:0;"><strong>E-mail de acesso:</strong> ${escapeHtml(payload.email)}</p>
      </div>
      <p>Acesse a plataforma por este link:</p>
      <p><a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>
      <p>Se você esquecer sua senha, utilize a opção <strong>Esqueci minha senha</strong> na tela de login para redefinir seu acesso com segurança.</p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${emailConfig.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Formando Valores <${emailConfig.from}>`,
      to: [payload.email],
      reply_to: emailConfig.replyTo || undefined,
      subject: 'Acesso à plataforma Formando Valores',
      html,
      text: [
        `Olá, ${recipientName}.`,
        `Seu cadastro foi realizado com sucesso via ${sourceLabel}.`,
        `E-mail de acesso: ${payload.email}`,
        `Acesse: ${loginUrl}`,
        'Caso esqueça sua senha, utilize a opção "Esqueci minha senha" na tela de login para redefinir seu acesso.',
      ].join('\n'),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      error: `Falha ao enviar e-mail de credenciais: ${errorText || response.statusText}`,
    };
  }

  return { ok: true };
}

export async function sendPasswordResetEmail(payload: PasswordResetEmailPayload) {
  const emailConfig = getEmailConfig();

  if (!emailConfig) {
    return {
      ok: false,
      error: 'Serviço de e-mail não configurado. Defina RESEND_API_KEY e FROM_EMAIL.',
    };
  }

  const recipientName = payload.fullName?.trim() || 'cliente';
  const loginUrl = payload.loginUrl?.trim() || 'https://sgi-fv-prod.vercel.app/#/login';
  const resetUrl = payload.resetUrl.trim();

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2>Redefinição de senha</h2>
      <p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta na plataforma Formando Valores.</p>
      <p>Para criar uma nova senha com segurança, clique no botão abaixo:</p>
      <p style="margin:24px 0;">
        <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;">
          Redefinir minha senha
        </a>
      </p>
      <p>Se você não solicitou esta alteração, pode ignorar este e-mail.</p>
      <p>Após redefinir sua senha, você poderá acessar a plataforma em:</p>
      <p><a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${emailConfig.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Formando Valores <${emailConfig.from}>`,
      to: [payload.email],
      reply_to: emailConfig.replyTo || undefined,
      subject: 'Redefinição de senha - Formando Valores',
      html,
      text: [
        `Olá, ${recipientName}.`,
        'Recebemos uma solicitação para redefinir a senha da sua conta na plataforma Formando Valores.',
        `Abra este link para redefinir sua senha: ${resetUrl}`,
        `Depois disso, acesse: ${loginUrl}`,
        'Se você não solicitou esta alteração, ignore este e-mail.',
      ].join('\n'),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      error: `Falha ao enviar e-mail de redefinição: ${errorText || response.statusText}`,
    };
  }

  return { ok: true };
}
