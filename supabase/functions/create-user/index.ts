import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Método não permitido.' });
  }

  try {
    const { email, password, name, role, org_id, unit } = await request.json();

    if (!email || !password || !name || !org_id) {
      return jsonResponse(400, { error: 'Campos obrigatórios: email, password, name, org_id.' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { error: 'Erro de configuração do servidor.' });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome_completo: name, name },
    });

    if (authError || !authData.user) {
      return jsonResponse(400, { error: `Erro ao criar usuário no Auth: ${authError?.message || 'desconhecido'}` });
    }

    const userId = authData.user.id;
    const normalizedRole = role === 'Administrador' ? 'admin' : 'cliente';

    // 2. Create profile
    const { error: profileError } = await adminClient.from('profiles').insert({
      id: userId,
      email,
      nome_completo: name,
      name,
      role: normalizedRole,
      org_id,
    });

    if (profileError) {
      // Cleanup auth user if profile fails
      await adminClient.auth.admin.deleteUser(userId).catch(() => {});
      return jsonResponse(400, { error: `Erro ao criar perfil: ${profileError.message}` });
    }

    // 3. Create org_members link
    const orgRole = role === 'Administrador' ? 'admin' : 'member';
    const { error: memberError } = await adminClient.from('org_members').insert({
      org_id,
      user_id: userId,
      role: orgRole,
    });

    if (memberError) {
      // Non-fatal: profile already created, user can still login
      console.warn('[create-user] org_members insert failed:', memberError.message);
    }

    // 4. Auto-create membership process (annual fee)
    const { data: processData, error: processError } = await adminClient.from('processes').insert({
      org_id,
      titulo: `Filiação - ${name}`,
      status: 'cadastro',
      cliente_user_id: userId,
      cliente_nome: name,
      origem_canal: 'painel',
      os_value: 180,
      process_status: 'aguardando_pagamento',
      association_fees: [
        { type: 'annual', name: 'Taxa Associativa Anual', price: 180, destination: 'association' },
      ],
    }).select('id').single();

    if (processError) {
      console.warn('[create-user] auto-membership process failed:', processError.message);
    }

    return jsonResponse(200, {
      success: true,
      user_id: userId,
      email,
      name,
    });

  } catch (err) {
    return jsonResponse(500, { error: `Erro interno: ${err instanceof Error ? err.message : 'desconhecido'}` });
  }
});
