import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendPasswordResetEmail } from './accessEmail.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const genericMessage = 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha.';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const generatedActionLink =
      data?.properties?.action_link ||
      data?.properties?.hashed_token ||
      data?.action_link ||
      '';

    if (!generatedActionLink || generatedActionLink === data?.properties?.hashed_token) {
      return jsonResponse(200, { success: true, message: genericMessage });
    }

    const emailResult = await sendPasswordResetEmail({
      email,
      fullName: String(profile?.nome_completo ?? '').trim(),
      loginUrl,
      resetUrl: generatedActionLink,
    });

    if (!emailResult.ok) {
      console.error('[forgot-password] falha ao enviar email de redefinição', emailResult.error);
    }

    return jsonResponse(200, { success: true, message: genericMessage });
  } catch {
    return jsonResponse(200, { success: true, message: genericMessage });
  }
});
