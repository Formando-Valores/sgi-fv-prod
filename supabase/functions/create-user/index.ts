import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveCaller, withOrgRole } from '../_shared/auth.ts';
import { decideCreateUser, uiRoleToOrgRole } from '../_shared/authz.ts';

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
    const { email, password, name, role, org_id, unit, action, source, siteName, documentType, documentId, taxId, phone, maritalStatus, country, address, postalCode, profession, nationality, birthDate, naturalidade, niss, docExpiry } = await request.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { error: 'Erro de configuração do servidor.' });
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // MISSÃO 002 / R-01: identificar quem chama (anónimo = registo público; utilizador; service role)
    const caller = await withOrgRole(await resolveCaller(request), adminClient, org_id);
    const requestedRole = uiRoleToOrgRole(role === 'Administrador' ? 'admin' : 'client');

    // --- DELETE action: remove auth user and cascade (apenas admin global / service role) ---
    if (action === 'delete') {
      const decision = decideCreateUser(caller, { action, requestedRole, userAlreadyExists: true });
      if (!decision.allowed) {
        return jsonResponse(decision.status ?? 403, { error: decision.reason });
      }
      if (!email) {
        return jsonResponse(400, { error: 'Email é obrigatório para exclusão.' });
      }

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

    // A organização tem de existir (evita vínculos a org_id arbitrários)
    const { data: orgRow } = await adminClient.from('organizations').select('id').eq('id', org_id).maybeSingle();
    if (!orgRow) {
      return jsonResponse(400, { error: 'Organização inválida.' });
    }

    // --- Determine user_id: reuse existing or create new auth user ---
    let userId: string;
    let userAlreadyExisted = false;

    // 1. Check if profile already exists for this email
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    let existingAuthId: string | null = existingProfile?.id ?? null;
    if (!existingAuthId) {
      const { data: usersList } = await adminClient.auth.admin.listUsers();
      existingAuthId = usersList?.users?.find(u => (u.email ?? '').toLowerCase() === String(email).toLowerCase())?.id ?? null;
    }

    const decision = decideCreateUser(caller, { action, requestedRole, userAlreadyExists: !!existingAuthId });
    if (!decision.allowed) {
      return jsonResponse(decision.status ?? 403, { error: decision.reason });
    }

    if (existingAuthId) {
      userId = existingAuthId;
      userAlreadyExisted = true;
      if (decision.mayResetPassword) {
        // Só o admin global / service role pode redefinir senha de contas existentes
        const { error: updatePwdError } = await adminClient.auth.admin.updateUserById(userId, { password });
        if (updatePwdError) {
          console.error('[create-user] erro ao atualizar senha do usuário existente:', updatePwdError.message);
        }
      }
    } else {
      // 2. Create auth user
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome_completo: name, name },
      });

      if (authError) {
        console.error('[create-user] auth error:', JSON.stringify(authError));
        const authErrMsg = typeof authError.message === 'string' ? authError.message : JSON.stringify(authError);
        if (authErrMsg?.toLowerCase().includes('already registered')) {
          return jsonResponse(409, { error: 'Este e-mail já está registado. Utilize "Esqueci a senha" para recuperar o acesso.' });
        }
        return jsonResponse(400, { error: `Erro ao criar usuário no Auth: ${authErrMsg}` });
      } else if (authData?.user) {
        userId = authData.user.id;
      } else {
        return jsonResponse(500, { error: 'Erro inesperado ao criar usuário no Auth.' });
      }
    }

    const effectiveRole = decision.effectiveRole;
    const normalizedRole = effectiveRole === 'admin' || effectiveRole === 'owner' ? 'admin' : 'cliente';
    // Contas existentes: o perfil só é sobrescrito pelo admin global / service role
    const mayWriteProfile = !userAlreadyExisted || decision.mayResetPassword;

    // 3. Upsert profile (insert if new, update if exists)
    const { error: profileError } = !mayWriteProfile ? { error: null } : await adminClient
      .from('profiles')
      .upsert({
        id: userId,
        email,
        nome_completo: name,
        name,
        role: normalizedRole,
        org_id,
        documento_identidade: documentId || null,
        nif_cpf: taxId || null,
        phone: phone || null,
        estado_civil: maritalStatus || null,
        pais: country || null,
        endereco: address || null,
        codigo_postal: postalCode || null,
        profissao: profession || null,
        nacionalidade: nationality || null,
        data_nascimento: birthDate || null,
        naturalidade: naturalidade || null,
        niss: niss || null,
        validade_documento: docExpiry || null,
      }, { onConflict: 'id' });

    if (profileError) {
      return jsonResponse(400, { error: `Erro ao salvar perfil: ${profileError.message}` });
    }

    // 4. Upsert org_members link
    const orgRole = effectiveRole;
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
    let emailError: string | undefined;

    if (!existingProcess) {
      const { data: newProcess, error: processError } = await adminClient
        .from('processes')
        .insert({
          org_id,
          titulo: `Filiação - ${name}`,
          status: 'cadastro',
          cliente_user_id: userId,
          cliente_nome: name,
          origem_canal: source || 'painel',
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
        try {
          const stripeResponse = await fetch(
            `${supabaseUrl}/functions/v1/stripe-create-checkout-session`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: supabaseAnonKey,
                // chamada servidor→servidor: o valor é calculado em stripe-create-checkout-session
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
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
              },
              body: JSON.stringify({
                email,
                fullName: name,
                source: 'cadastro_admin',
                profile: normalizedRole === 'admin' ? 'ADMINISTRADOR' : 'CLIENTE',
                // Não enviar uma senha que não foi aplicada (conta existente sem redefinição)
                ...(!userAlreadyExisted || decision.mayResetPassword ? { temporaryPassword: password } : {}),
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
      ...(userAlreadyExisted ? { existing_user: true, password_changed: decision.mayResetPassword } : {}),
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
