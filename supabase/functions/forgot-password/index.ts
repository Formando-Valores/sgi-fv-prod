import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const genericMessage = 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PasswordResetEmailPayload = {
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

const sendPasswordResetEmail = async (payload: PasswordResetEmailPayload) => {
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
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Método não permitido.' });
  }

  const supabaseUrl = Deno.env.get('URL_SUPABASE') ?? Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY_SUPABASE') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { success: false, error: 'Configuração do Supabase ausente na Edge Function.' });
  }

  const payload = await request.json().catch(() => ({}));
  const email = String(payload.email ?? '').trim().toLowerCase();
  const redirectTo = String(payload.redirectTo ?? '').trim();
  const loginUrl = String(payload.loginUrl ?? '').trim();

  if (!email) {
    return jsonResponse(400, { success: false, error: 'E-mail é obrigatório.' });
  }

  if (!emailPattern.test(email)) {
    return jsonResponse(400, { success: false, error: 'Informe um e-mail válido.' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const recoveryRedirectUrl =
    redirectTo ||
    `${String(Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://sgi-fv-prod.vercel.app').replace(/\/$/, '')}/recovery.html`;

  try {
    const { data: profile, error: profileLookupError } = await adminClient
      .from('profiles')
      .select('id,nome_completo')
      .eq('email', email)
      .maybeSingle();

    if (profileLookupError) {
      console.warn('[forgot-password] não foi possível buscar profile para enriquecer o e-mail', profileLookupError);
    }

    const { data, error } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: recoveryRedirectUrl,
      },
    });

    if (error) {
      return jsonResponse(200, { success: true, message: genericMessage });
    }

    const generatedOtpToken = data?.properties?.email_otp || '';
    const generatedTokenHash = data?.properties?.hashed_token || data?.properties?.token_hash || '';

    if (!generatedTokenHash && !generatedOtpToken) {
      return jsonResponse(200, { success: true, message: genericMessage });
    }

    const separator = recoveryRedirectUrl.includes('?') ? '&' : '?';
    const generatedResetUrl = generatedTokenHash
      ? `${recoveryRedirectUrl}${separator}token_hash=${encodeURIComponent(generatedTokenHash)}&type=recovery`
      : `${recoveryRedirectUrl}${separator}token=${encodeURIComponent(generatedOtpToken)}&type=recovery&email=${encodeURIComponent(email)}`;

    const emailResult = await sendPasswordResetEmail({
      email,
      fullName: String(profile?.nome_completo ?? '').trim(),
      loginUrl,
      resetUrl: generatedResetUrl,
    });

    if (!emailResult.ok) {
      console.error('[forgot-password] falha ao enviar email de redefinição', emailResult.error);
    }

    return jsonResponse(200, { success: true, message: genericMessage });
  } catch {
    return jsonResponse(200, { success: true, message: genericMessage });
  }
});
