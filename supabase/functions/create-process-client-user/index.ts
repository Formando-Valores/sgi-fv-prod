import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveCaller, withOrgRole } from '../_shared/auth.ts';
import { isStaffCaller } from '../_shared/authz.ts';
import { getResendConfig, sendMemberWelcomeAndTutorial, sendResendEmail } from '../_shared/memberEmailSender.ts';
import { getLoginUrl, renderHtml, renderPlainText, senderNameForOrg } from '../_shared/memberEmails.ts';

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

    // MISSÃO 002 / R-03: só staff autenticado da organização do processo (ou admin global / service role)
    const caller = await withOrgRole(await resolveCaller(request), adminClient, orgId);
    if (caller.kind === 'anonymous') {
      return jsonResponse(401, { error: 'Sessão inválida ou expirada. Inicie sessão novamente.' });
    }
    if (!isStaffCaller(caller)) {
      return jsonResponse(403, { error: 'Sem permissão para criar clientes nesta organização.' });
    }
    const { data: processRow } = await adminClient
      .from('processes')
      .select('id, org_id')
      .eq('id', processId)
      .maybeSingle();
    if (!processRow || String(processRow.org_id) !== String(orgId)) {
      return jsonResponse(404, { error: 'Processo não encontrado nesta organização.' });
    }

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
            // Conta já existia: a senha gerada NÃO foi aplicada, não a enviar por e-mail
            isNewUser = false;
            password = '';
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
      .eq('id', processId)
      .eq('org_id', orgId);

    if (updateError) {
      console.warn('[create-process-client-user] erro ao vincular cliente ao processo:', updateError.message);
    }

    // E-mails: novo cliente → E-mail 1 (dados de acesso) + E-mail 2 (guia rápido);
    // cliente existente → aviso de novo processo.
    let emailWarning: string | undefined;
    if (isNewUser) {
      const result = await sendMemberWelcomeAndTutorial({
        email,
        fullName: name,
        loginUrl: getLoginUrl(),
        orgId,
        origin: 'admin',
        passwordDefinedByUser: false,
        temporaryPassword: password,
      });
      if (!result.ok) emailWarning = result.error;
    } else {
      const config = getResendConfig();
      if (config) {
        const recipientName = String(name ?? '').trim() || 'cliente';
        const lines = [
          `Olá, ${recipientName},`,
          '',
          'Um novo processo administrativo foi aberto em seu nome no sistema SIGA-FV.',
          '',
          'Acesse o sistema para acompanhar o andamento:',
          getLoginUrl(),
          '',
          'Caso tenha dúvidas, entre em contato com o administrador da organização.',
        ];
        const result = await sendResendEmail(config, {
          to: [email],
          senderName: senderNameForOrg(orgId),
          content: {
            subject: 'Novo processo aberto em seu nome - SIGA-FV',
            text: renderPlainText(lines),
            html: renderHtml(lines),
          },
        });
        if (!result.ok) emailWarning = result.error;
      }
    }
    if (emailWarning) console.error('[create-process-client-user] erro ao enviar email:', emailWarning);

    return jsonResponse(200, {
      success: true,
      user_id: userId,
      email,
      is_new_user: isNewUser,
      ...(emailWarning ? { email_warning: emailWarning } : {}),
    });
  } catch (err) {
    return jsonResponse(500, { error: `Erro interno: ${err instanceof Error ? err.message : 'desconhecido'}` });
  }
});
