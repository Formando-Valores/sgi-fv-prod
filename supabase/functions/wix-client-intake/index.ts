import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendAccessCredentialsEmail } from './accessEmail.ts';
import { CONSENT_TEXT_VERSION } from './consent.ts';

type IntakePayload = {
  organizationSlug?: string;
  organizationRequestedName?: string;
  siteName?: string;
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  documentId?: string;
  taxId?: string;
  address?: string;
  maritalStatus?: string;
  country?: string;
  phone?: string;
  processTitle?: string;
  serviceUnit?: string;
  source?: string;
  consentPrivacyPolicy?: boolean | string | number | null;
  consentServiceContact?: boolean | string | number | null;
  consentInformativeCommunications?: boolean | string | number | null;
  consentTextVersion?: string;
  consentCapturedAt?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const normalizeUnit = (raw: string | undefined) => {
  const value = String(raw ?? '').trim().toLowerCase();

  if (value.includes('jur')) return 'JURÍDICO / ADVOCACIA';
  if (value.includes('admin')) return 'ADMINISTRATIVO';
  if (value.includes('tec') || value.includes('ai')) return 'TECNOLÓGICO / AI';

  return 'JURÍDICO / ADVOCACIA';
};

const buildResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const normalizeBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'sim', 'on'].includes(normalized);
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return buildResponse(405, { success: false, error: 'Método não permitido.' });
  }

  const integrationApiKey = Deno.env.get('WIX_INTAKE_API_KEY') ?? '';
  const headerApiKey = request.headers.get('x-api-key') ?? '';

  if (!integrationApiKey || headerApiKey !== integrationApiKey) {
    return buildResponse(401, { success: false, error: 'Integração não autorizada.' });
  }

  const supabaseUrl = Deno.env.get('URL_SUPABASE') ?? Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY_SUPABASE') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return buildResponse(500, { success: false, error: 'Configuração do Supabase ausente na Edge Function.' });
  }

  const payload = (await request.json()) as IntakePayload;

  const fullName = String(payload.fullName ?? '').trim();
  const email = String(payload.email ?? '').trim().toLowerCase();
  const password = String(payload.password ?? '');
  const confirmPassword = String(payload.confirmPassword ?? '');

  if (!fullName || !email || !password) {
    return buildResponse(400, { success: false, error: 'Nome, e-mail e senha são obrigatórios.' });
  }

  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return buildResponse(400, {
      success: false,
      error: 'A senha deve ter 8 caracteres, uma letra maiúscula, um caractere especial e um número.',
    });
  }

  if (password !== confirmPassword) {
    return buildResponse(400, { success: false, error: 'Senha e confirmação estão diferentes.' });
  }

  const serviceUnit = normalizeUnit(payload.serviceUnit);
  const source = String(payload.source ?? 'wix').trim() || 'wix';
  const siteName = String(payload.siteName ?? '').trim() || (source.toLowerCase() === 'wix' ? 'Wix' : source);
  const organizationRequestedName = String(payload.organizationRequestedName ?? '').trim();
  const consentPrivacyPolicy = normalizeBoolean(payload.consentPrivacyPolicy);
  const consentServiceContact = normalizeBoolean(payload.consentServiceContact);
  const consentInformativeCommunications = normalizeBoolean(payload.consentInformativeCommunications);
  const consentTextVersion = String(payload.consentTextVersion ?? '').trim() || CONSENT_TEXT_VERSION;
  const consentCapturedAtRaw = String(payload.consentCapturedAt ?? '').trim();
  const consentCapturedAt = consentCapturedAtRaw || new Date().toISOString();

  if (!consentPrivacyPolicy) {
    return buildResponse(400, {
      success: false,
      error: 'Consentimento obrigatório ausente: é necessário aceitar a política de privacidade.',
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    let orgId: string | null = null;

    const requestedSlug = String(payload.organizationSlug ?? 'default').trim() || 'default';
    const { data: orgBySlug } = await adminClient
      .from('organizations')
      .select('id')
      .eq('slug', requestedSlug)
      .maybeSingle();

    if (orgBySlug?.id) {
      orgId = orgBySlug.id;
    } else {
      const { data: defaultOrg } = await adminClient
        .from('organizations')
        .select('id')
        .eq('slug', 'default')
        .maybeSingle();

      if (defaultOrg?.id) {
        orgId = defaultOrg.id;
      }
    }

    if (!orgId) {
      const { data: firstOrg, error: firstOrgError } = await adminClient
        .from('organizations')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (firstOrgError || !firstOrg?.id) {
        return buildResponse(500, { success: false, error: 'Não foi possível identificar organização padrão para o cadastro.' });
      }

      orgId = firstOrg.id;
    }

    let userId: string | null = null;

    const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        source,
        source_site_name: siteName,
      },
    });

    if (createUserError) {
      const message = String(createUserError.message ?? '').toLowerCase();
      const isAlreadyRegistered = message.includes('already') || message.includes('registered') || message.includes('exists');

      if (!isAlreadyRegistered) {
        return buildResponse(400, { success: false, error: createUserError.message || 'Erro ao criar usuário.' });
      }

      return buildResponse(400, {
        success: false,
        error: `O e-mail ${email} já está cadastrado no sistema. Cada cliente deve ter um e-mail único. Utilize um e-mail diferente para este cadastro.`,
      });
    } else {
      userId = createdUser.user?.id ?? null;
    }

    if (!userId) {
      return buildResponse(500, { success: false, error: 'Não foi possível determinar o usuário criado.' });
    }

    const profilePayload = {
      id: userId,
      org_id: orgId,
      email,
      nome_completo: fullName,
      documento_identidade: String(payload.documentId ?? '').trim() || null,
      nif_cpf: String(payload.taxId ?? '').trim() || null,
      estado_civil: String(payload.maritalStatus ?? 'Solteiro').trim(),
      phone: String(payload.phone ?? '').trim() || null,
      endereco: String(payload.address ?? '').trim() || null,
      pais: String(payload.country ?? 'Brasil').trim(),
    };

    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert([profilePayload], { onConflict: 'id' });

    if (profileError) {
      return buildResponse(500, { success: false, error: `Erro ao criar/atualizar perfil: ${profileError.message}` });
    }

    const { error: memberError } = await adminClient
      .from('org_members')
      .upsert([{ org_id: orgId, user_id: userId, role: 'client' }], { onConflict: 'org_id,user_id' });

    if (memberError) {
      return buildResponse(500, { success: false, error: `Erro ao vincular usuário na organização: ${memberError.message}` });
    }

    const userAgent = request.headers.get('user-agent');

    const { error: consentError } = await adminClient
      .from('profile_consents')
      .insert([
        {
          profile_id: userId,
          source,
          consent_text_version: consentTextVersion,
          privacy_policy_accepted: consentPrivacyPolicy,
          service_contact_accepted: consentServiceContact,
          informative_comms_accepted: consentInformativeCommunications,
          accepted_at: consentCapturedAt,
          user_agent: userAgent || null,
        },
      ]);

    if (consentError) {
      return buildResponse(500, { success: false, error: `Erro ao registrar consentimento: ${consentError.message}` });
    }

    const processTitle = String(payload.processTitle ?? '').trim() || `Cadastro inicial - ${fullName}`;
    const processPayload = {
      org_id: orgId,
      titulo: processTitle,
      status: 'analise',
      cliente_nome: fullName,
      cliente_documento: String(payload.taxId ?? payload.documentId ?? '').trim() || null,
      cliente_contato: String(payload.phone ?? email).trim() || email,
      responsavel_user_id: userId,
      unidade_atendimento: serviceUnit,
      org_nome_solicitado: organizationRequestedName || null,
      origem_canal: source,
    };

    const { data: process, error: processError } = await adminClient
      .from('processes')
      .insert([processPayload])
      .select('id,protocolo')
      .single();

    if (processError) {
      return buildResponse(500, { success: false, error: `Erro ao criar processo inicial: ${processError.message}` });
    }

    const processId = process?.id as string | undefined;

    if (processId) {
      await adminClient.from('process_events').insert([
        {
          org_id: orgId,
          process_id: processId,
          tipo: 'registro',
          mensagem: `Processo recebido via integração externa (${source}). Site/portal: ${siteName}. Unidade: ${serviceUnit}. Organização solicitada: ${organizationRequestedName || 'não informada'}. Consentimentos: política_privacidade=${consentPrivacyPolicy ? 'sim' : 'não'}, contato_serviço=${consentServiceContact ? 'sim' : 'não'}, comunicações_informativas=${consentInformativeCommunications ? 'sim' : 'não'}, versão='${consentTextVersion ?? 'não informada'}', capturado_em='${consentCapturedAt}'.`,
          created_by: userId,
        },
      ]);
    }

    const appUrl = String(Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://sgi-fv-prod.vercel.app').replace(/\/$/, '');
    const loginUrl = `${appUrl}/#/login`;

    const emailResult = await sendAccessCredentialsEmail({
      email,
      fullName,
      loginUrl,
      source: `formulário externo • ${siteName}`,
      profile: 'USUÁRIO OPERADOR',
      temporaryPassword: password,
    });

    return buildResponse(200, {
      success: true,
      message: 'Cadastro recebido com sucesso.',
      data: {
        userId,
        processId: process?.id ?? null,
        protocol: process?.protocolo ?? null,
        role: 'client',
        linkedOrganizationId: orgId,
        linkedOrganizationSlug: requestedSlug || 'default',
        requestedOrganizationName: organizationRequestedName || null,
        source,
        siteName,
        credentialsEmailSent: emailResult.ok,
        credentialsEmailError: emailResult.ok ? null : emailResult.error,
      },
    });
  } catch (error) {
    return buildResponse(500, {
      success: false,
      error: `Erro inesperado na integração: ${error instanceof Error ? error.message : 'desconhecido'}`,
    });
  }
});
