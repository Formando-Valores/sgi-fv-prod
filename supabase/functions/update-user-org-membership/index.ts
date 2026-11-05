import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveCaller, withOrgRole } from '../_shared/auth.ts';
import { decideMembershipChange } from '../_shared/authz.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { user_id, org_id, role, name } = await request.json();

    if (!user_id || !org_id || !role) {
      return new Response(JSON.stringify({ error: 'user_id, org_id e role são obrigatórios.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const json = (status: number, body: Record<string, unknown>) =>
      new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // MISSÃO 002 / R-02: só admin da org de destino (ou admin global / service role)
    const caller = await withOrgRole(await resolveCaller(request), adminClient, org_id);
    if (caller.kind === 'anonymous') {
      return json(401, { error: 'Sessão inválida ou expirada. Inicie sessão novamente.' });
    }
    const decision = decideMembershipChange(caller, role);
    if (!decision.allowed) {
      return json(decision.status ?? 403, { error: decision.reason });
    }
    const superAdmin = caller.kind === 'service' || !!caller.isGlobalAdmin;

    // Vínculos atuais do utilizador alvo
    const { data: currentLinks } = await adminClient
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', user_id);
    const links = (currentLinks ?? []) as Array<{ org_id: string; role: string }>;

    let orgsToClear: string[] = links.map((l) => l.org_id);
    if (!superAdmin) {
      if (caller.userId === user_id) {
        return json(403, { error: 'Não pode alterar o seu próprio vínculo.' });
      }
      // O utilizador alvo não pode ser owner noutra organização nem admin global
      const { data: targetIsGlobal } = await adminClient.rpc('is_default_org_admin', { check_user_id: user_id });
      if (targetIsGlobal === true) {
        return json(403, { error: 'Não é permitido alterar o vínculo do administrador global.' });
      }
      const otherOrgs = links.filter((l) => l.org_id !== org_id);
      if (otherOrgs.length > 0) {
        // Só remove vínculos em organizações que quem chama também administra
        const { data: callerAdminLinks } = await adminClient
          .from('org_members')
          .select('org_id')
          .eq('user_id', caller.userId)
          .in('role', ['admin', 'owner']);
        const administered = new Set(((callerAdminLinks ?? []) as Array<{ org_id: string }>).map((l) => l.org_id));
        const foreign = otherOrgs.filter((l) => !administered.has(l.org_id));
        if (foreign.length > 0) {
          return json(403, { error: 'O utilizador pertence a outra organização que não administra.' });
        }
      }
      const targetCurrent = links.find((l) => l.org_id === org_id);
      if (targetCurrent?.role === 'owner' && caller.orgRole !== 'owner') {
        return json(403, { error: 'Apenas um owner pode alterar outro owner.' });
      }
    }

    if (orgsToClear.length > 0) {
      const { error: deleteError } = await adminClient
        .from('org_members')
        .delete()
        .eq('user_id', user_id)
        .in('org_id', orgsToClear);

      if (deleteError) {
        return json(500, { error: `Erro ao remover vínculos anteriores: ${deleteError.message}` });
      }
    }

    const { error: insertError } = await adminClient
      .from('org_members')
      .insert({ org_id, user_id, role: decision.role });

    if (insertError) {
      return new Response(JSON.stringify({ error: `Erro ao criar vínculo: ${insertError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const profileUpdate: Record<string, unknown> = { org_id };
    if (name) {
      profileUpdate.nome_completo = name;
      profileUpdate.name = name;
    }
    profileUpdate.role = decision.role === 'admin' || decision.role === 'owner' ? 'Administrador' : 'Cliente';

    const { error: profileError } = await adminClient
      .from('profiles')
      .update(profileUpdate)
      .eq('id', user_id);

    let profile_warning = '';
    if (profileError) {
      profile_warning = `Perfil não atualizado: ${profileError.message}`;
    }

    return new Response(JSON.stringify({ success: true, user_id, org_id, role: decision.role, profile_warning: profile_warning || undefined }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: `Erro interno: ${String(err)}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
