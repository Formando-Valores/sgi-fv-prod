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
    const { email, password, name, role, org_id, unit, action } = await request.json();

    // --- DELETE action: remove auth user and cascade ---
    if (action === 'delete') {
      if (!email) {
        return jsonResponse(400, { error: 'Email é obrigatório para exclusão.' });
      }
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      if (!supabaseUrl || !serviceRoleKey) {
        return jsonResponse(500, { error: 'Erro de configuração do servidor.' });
      }
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Find user in auth
      const { data: usersList } = await adminClient.auth.admin.listUsers();
      const user = usersList?.users?.find(u => u.email === email);
      if (user) {
        const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id);
        if (deleteAuthError) {
          return jsonResponse(400, { error: `Erro ao excluir auth user: ${deleteAuthError.message}` });
        }
      }

      // Delete profile (in case auth user was already gone)
      const { error: deleteProfileError } = await adminClient
        .from('profiles')
        .delete()
        .eq('email', email);
      if (deleteProfileError) {
        console.warn('[create-user] delete profile warning:', deleteProfileError.message);
      }

      return jsonResponse(200, { success: true, message: `Usuário ${email} excluído.` });
    }

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

    // --- Determine user_id: reuse existing or create new auth user ---
    let userId: string;

    // 1. Check if profile already exists for this email
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile?.id) {
      userId = existingProfile.id;
    } else {
      // 2. Try to create auth user
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome_completo: name, name },
      });

      if (authError) {
        // If "already registered", try to find the existing user
        if (authError.message?.toLowerCase().includes('already registered')) {
          const { data: usersList } = await adminClient.auth.admin.listUsers();
          const found = usersList?.users?.find(u => u.email === email);
          if (found) {
            userId = found.id;
          } else {
            return jsonResponse(400, { error: `Usuário já existe mas não foi possível localizá-lo: ${authError.message}` });
          }
        } else {
          return jsonResponse(400, { error: `Erro ao criar usuário no Auth: ${authError.message}` });
        }
      } else if (authData?.user) {
        userId = authData.user.id;
      } else {
        return jsonResponse(500, { error: 'Erro inesperado ao criar usuário no Auth.' });
      }
    }

    const normalizedRole = role === 'Administrador' ? 'admin' : 'cliente';

    // 3. Upsert profile (insert if new, update if exists)
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: userId,
        email,
        nome_completo: name,
        name,
        role: normalizedRole,
        org_id,
      }, { onConflict: 'id' });

    if (profileError) {
      return jsonResponse(400, { error: `Erro ao salvar perfil: ${profileError.message}` });
    }

    // 4. Upsert org_members link
    const orgRole = role === 'Administrador' ? 'admin' : 'client';
    const { error: memberError } = await adminClient
      .from('org_members')
      .upsert({
        org_id,
        user_id: userId,
        role: orgRole,
      }, { onConflict: 'org_id,user_id' });

    if (memberError) {
      return jsonResponse(400, { error: `Erro ao vincular cliente à organização: ${memberError.message}` });
    }

    // 5. Auto-create membership process only if one doesn't already exist
    const { data: existingProcess } = await adminClient
      .from('processes')
      .select('id')
      .eq('cliente_user_id', userId)
      .eq('titulo', `Filiação - ${name}`)
      .maybeSingle();

    let processWarning: string | undefined;
    let processId: string | undefined;

    if (!existingProcess) {
      const { data: newProcess, error: processError } = await adminClient
        .from('processes')
        .insert({
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
        })
        .select('id')
        .single();

      if (processError) {
        processWarning = `Processo de pagamento da taxa não foi criado: ${processError.message}`;
      } else {
        processId = newProcess?.id;
      }
    } else {
      processId = existingProcess.id;
    }

    // 6. Create Stripe checkout session and send credentials email
    if (processId) {
      const appUrl = Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://sgi-fv-prod.vercel.app';
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

      if (supabaseAnonKey) {
        const successUrl = `${appUrl}/#/payments/success?processId=${processId}`;
        const cancelUrl = `${appUrl}/#/payments/cancel?processId=${processId}`;

        let paymentUrl = '';
        let emailError: string | undefined;
        try {
          const stripeResponse = await fetch(
            `${supabaseUrl}/functions/v1/stripe-create-checkout-session`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                amount: 18000,
                currency: 'brl',
                successUrl,
                cancelUrl,
                processId,
                clientId: userId,
                serviceId: '',
                organizationId: org_id,
                areaId: '',
                sectorId: '',
              }),
            }
          );
          const stripeResult = await stripeResponse.json();
          if (stripeResult.url) paymentUrl = stripeResult.url;
        } catch (e) {
          console.error('[create-user] erro ao criar checkout session:', e);
        }

        try {
          const emailResponse = await fetch(
            `${supabaseUrl}/functions/v1/send-access-credentials`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                email,
                fullName: name,
                source: 'cadastro_admin',
                profile: normalizedRole === 'admin' ? 'ADMINISTRADOR' : 'CLIENTE',
                temporaryPassword: password,
                loginUrl: `${appUrl}/#/login`,
                ...(paymentUrl ? { paymentUrl } : {}),
              }),
            }
          );
          if (!emailResponse.ok) {
            const emailBody = await emailResponse.text();
            emailError = `send-access-credentials retornou ${emailResponse.status}: ${emailBody}`;
            console.error('[create-user] erro ao enviar email:', emailError);
          }
        } catch (e) {
          emailError = e instanceof Error ? e.message : 'erro desconhecido';
          console.error('[create-user] erro ao enviar email de credenciais:', e);
        }
      }
    }

    const result: Record<string, unknown> = {
      success: true,
      user_id: userId,
      email,
      name,
    };
    if (processWarning) {
      result.process_warning = processWarning;
    }
    if (emailError) {
      result.email_warning = emailError;
    }
    return jsonResponse(200, result);

  } catch (err) {
    return jsonResponse(500, { error: `Erro interno: ${err instanceof Error ? err.message : 'desconhecido'}` });
  }
});
