export type AccessEmailPayload = {
  email: string;
  password: string;
  fullName?: string;
  loginUrl?: string;
  source?: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export async function sendAccessCredentialsEmail(payload: AccessEmailPayload) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const from = Deno.env.get('ACCESS_EMAIL_FROM') ?? '';
  const replyTo = Deno.env.get('ACCESS_EMAIL_REPLY_TO') ?? '';

  if (!resendApiKey || !from) {
    return {
      ok: false,
      error: 'Serviço de e-mail não configurado. Defina RESEND_API_KEY e ACCESS_EMAIL_FROM.',
    };
  }

  const recipientName = payload.fullName?.trim() || 'cliente';
  const loginUrl = payload.loginUrl?.trim() || 'https://sgi-fv-prod.vercel.app/#/login';
  const sourceLabel = payload.source?.trim() || 'plataforma SGI FV';

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2>Seu acesso foi criado com sucesso</h2>
      <p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p>
      <p>Recebemos o seu cadastro via <strong>${escapeHtml(sourceLabel)}</strong> e suas credenciais de acesso já estão disponíveis.</p>
      <div style="padding:16px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;margin:16px 0;">
        <p style="margin:0 0 8px;"><strong>Login:</strong> ${escapeHtml(payload.email)}</p>
        <p style="margin:0;"><strong>Senha:</strong> ${escapeHtml(payload.password)}</p>
      </div>
      <p>Acesse a plataforma por este link:</p>
      <p><a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>
      <p>Por segurança, recomendamos alterar a senha no primeiro acesso.</p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [payload.email],
      reply_to: replyTo || undefined,
      subject: 'Credenciais de acesso - SGI FV',
      html,
      text: [
        `Olá, ${recipientName}.`,
        `Seu cadastro foi recebido via ${sourceLabel}.`,
        `Login: ${payload.email}`,
        `Senha: ${payload.password}`,
        `Acesse: ${loginUrl}`,
        'Por segurança, recomendamos alterar a senha no primeiro acesso.',
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
