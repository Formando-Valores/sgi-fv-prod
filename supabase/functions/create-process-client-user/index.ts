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
    const { email, name, document, contact, processId, orgId } = await request.json();

    if (!email || !name || !processId || !orgId) {
      return jsonResponse(400, { error: 'Campos obrigatórios: email, name, processId, orgId.' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { error: 'Erro de configuração do servidor.' });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let userId: string;
    let isNewUser = false;

    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile?.id) {
      userId = existingProfile.id;
    } else {
      isNewUser = true;
      const password = crypto.randomUUID().slice(0, 12) + 'Aa1!';

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome_completo: name, name },
      });

      if (authError) {
        const msg = typeof authError.message === 'string' ? authError.message : JSON.stringify(authError);
        if (msg.toLowerCase().includes('already registered')) {
          const { data: usersList } = await adminClient.auth.admin.listUsers();
          const found = usersList?.users?.find(u => u.email === email);
          if (found) {
            userId = found.id;
          } else {
            return jsonResponse(400, { error: `Usuário já existe mas não foi possível localizá-lo: ${msg}` });
          }
        } else {
          return jsonResponse(400, { error: `Erro ao criar usuário no Auth: ${msg}` });
        }
      } else if (authData?.user) {
        userId = authData.user.id;
      } else {
        return jsonResponse(500, { error: 'Erro inesperado ao criar usuário no Auth.' });
      }

      const { error: profileError } = await adminClient
        .from('profiles')
        .upsert({
          id: userId,
          email,
          nome_completo: name,
          name,
          role: 'cliente',
          org_id: orgId,
        }, { onConflict: 'id' });

      if (profileError) {
        return jsonResponse(400, { error: `Erro ao salvar perfil: ${profileError.message}` });
      }

      const { error: memberError } = await adminClient
        .from('org_members')
        .upsert({
          org_id: orgId,
          user_id: userId,
          role: 'client',
        }, { onConflict: 'org_id,user_id' });

      if (memberError) {
        return jsonResponse(400, { error: `Erro ao vincular cliente à organização: ${memberError.message}` });
      }

      const { error: updateError } = await adminClient
        .from('processes')
        .update({ cliente_user_id: userId })
        .eq('id', processId);

      if (updateError) {
        console.warn('[create-process-client-user] erro ao vincular cliente ao processo:', updateError.message);
      }

      const appUrl = Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://sgi-fv-prod.vercel.app';
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

      if (supabaseAnonKey) {
        try {
          const emailResponse = await fetch(
            `${supabaseUrl}/functions/v1/send-access-credentials`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: supabaseAnonKey,
              },
              body: JSON.stringify({
                email,
                fullName: name,
                source: 'cadastro_processo',
                profile: 'CLIENTE',
                temporaryPassword: password,
                loginUrl: `${appUrl}/#/login`,
              }),
            }
          );
          if (!emailResponse.ok) {
            const emailBody = await emailResponse.text();
            console.error('[create-process-client-user] erro ao enviar email:', emailResponse.status, emailBody);
          }
        } catch (e) {
          console.error('[create-process-client-user] erro ao enviar email de credenciais:', e);
        }
      }
    }

    return jsonResponse(200, {
      success: true,
      user_id: userId,
      email,
      is_new_user: isNewUser,
    });
  } catch (err) {
    return jsonResponse(500, { error: `Erro interno: ${err instanceof Error ? err.message : 'desconhecido'}` });
  }
});
