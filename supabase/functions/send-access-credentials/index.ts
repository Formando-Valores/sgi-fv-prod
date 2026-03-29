import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendAccessCredentialsEmail } from './accessEmail.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  const authHeader = request.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  const supabaseUrl = Deno.env.get('URL_SUPABASE') ?? Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';

  if (!supabaseUrl || !anonKey || !jwt) {
    return jsonResponse(401, { success: false, error: 'Sessão inválida para envio do e-mail de acesso.' });
  }

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: userData, error: userError } = await client.auth.getUser(jwt);
  if (userError || !userData.user?.email) {
    return jsonResponse(401, { success: false, error: 'Usuário autenticado não encontrado.' });
  }

  const payload = await request.json();
  const email = String(payload.email ?? '').trim().toLowerCase();
  const fullName = String(payload.fullName ?? '').trim();
  const loginUrl = String(payload.loginUrl ?? '').trim();
  const source = String(payload.source ?? 'cadastro interno').trim();

  if (!email) {
    return jsonResponse(400, { success: false, error: 'E-mail é obrigatório.' });
  }

  if (email !== userData.user.email.toLowerCase()) {
    return jsonResponse(403, { success: false, error: 'Só é permitido enviar credenciais para o próprio cadastro autenticado.' });
  }

  const emailResult = await sendAccessCredentialsEmail({
    email,
    fullName,
    loginUrl,
    source,
  });

  if (!emailResult.ok) {
    return jsonResponse(503, { success: false, error: emailResult.error });
  }

  return jsonResponse(200, { success: true });
});
