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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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
    let password = '';

    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile?.id) {
      userId = existingProfile.id;
    } else {
      isNewUser = true;
      password = crypto.randomUUID().slice(0, 12) + 'Aa1!';

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
    }

    // Always link user to process
    const { error: updateError } = await adminClient
      .from('processes')
      .update({ cliente_user_id: userId })
      .eq('id', processId);

    if (updateError) {
      console.warn('[create-process-client-user] erro ao vincular cliente ao processo:', updateError.message);
    }

    // Send email: credentials for new users, notification for existing
    const appUrl = Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://sgi-fv-prod.vercel.app';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? Deno.env.get('ACCESS_EMAIL_API_KEY') ?? '';
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? Deno.env.get('ACCESS_EMAIL_FROM') ?? '';

    if (resendApiKey && fromEmail) {
      const loginUrl = `${appUrl}/#/login`;
      const recipientName = name?.trim() || 'cliente';

      let subject: string;
      let bodyLines: string[];

      if (isNewUser) {
        subject = 'Bem-vindo ao SIGA-FV - Dados de acesso';
        bodyLines = [
          `Olá, ${recipientName},`,
          '',
          'Você foi cadastrado no sistema SIGA-FV como CLIENTE.',
          '',
          'Para acessar o sistema e acompanhar seu processo, utilize os dados abaixo:',
          '',
          `Login: ${email}`,
          `Senha provisória: ${password}`,
          '',
          'Acesse o sistema:',
          loginUrl,
          '',
          '⚠️ Por segurança, altere sua senha no primeiro acesso.',
        ];
      } else {
        subject = 'Novo processo aberto em seu nome - SIGA-FV';
        bodyLines = [
          `Olá, ${recipientName},`,
          '',
          'Um novo processo administrativo foi aberto em seu nome no sistema SIGA-FV.',
          '',
          'Acesse o sistema para acompanhar o andamento:',
          loginUrl,
          '',
          'Caso tenha dúvidas, entre em contato com o administrador da organização.',
        ];
      }

      const html = `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#0f172a;white-space:pre-line;">${bodyLines.map(l => escapeHtml(l)).join('\n')}</div>`;

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `Formando Valores <${fromEmail}>`,
            to: [email],
            subject,
            html,
            text: bodyLines.join('\n'),
          }),
        });
      } catch (e) {
        console.error('[create-process-client-user] erro ao enviar email:', e);
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
