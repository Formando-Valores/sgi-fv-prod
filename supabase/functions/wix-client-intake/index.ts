import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type IntakePayload = {
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
  serviceUnit?: string;
  requestedOrganizationName?: string;
  processTitle?: string;
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const validatePassword = (value: string) => {
  const hasMinLength = value.length >= 8;
  const hasUpper = /[A-Z]/.test(value);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  return hasMinLength && hasUpper && hasSpecial && hasNumber;
};

const ALLOWED_SERVICE_UNITS = [
  'JURÍDICO / ADVOCACIA',
  'ADMINISTRATIVO',
  'TECNOLÓGICO / AI',
] as const;

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 45);

async function generateUniqueOrgSlug(admin: ReturnType<typeof createClient>, organizationName: string) {
  const baseSlug = slugify(organizationName) || `org-${Date.now()}`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { data: existing } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (!existing) {
      return candidate;
    }
  }

  return `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const apiKey = req.headers.get('x-api-key');
  const expectedApiKey = Deno.env.get('WIX_INTAKE_API_KEY');

  if (!expectedApiKey) {
    return jsonResponse({ error: 'WIX_INTAKE_API_KEY não configurada no ambiente' }, 500);
  }

  if (!apiKey || apiKey !== expectedApiKey) {
    return jsonResponse({ error: 'Acesso negado' }, 401);
  }

  let payload: IntakePayload;

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Payload inválido' }, 400);
  }

  const {
    fullName = '',
    email = '',
    password = '',
    confirmPassword = '',
    documentId = '',
    taxId = '',
    address = '',
    maritalStatus = 'Solteiro',
    country = 'Brasil',
    phone = '',
    serviceUnit = 'JURÍDICO / ADVOCACIA',
    requestedOrganizationName = '',
    processTitle,
  } = payload;

  if (!fullName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
    return jsonResponse({ error: 'Nome, email e senha são obrigatórios' }, 400);
  }

  if (password !== confirmPassword) {
    return jsonResponse({ error: 'As senhas não coincidem' }, 400);
  }

  if (!validatePassword(password)) {
    return jsonResponse({
      error: 'A senha deve ter 8 caracteres, uma letra maiúscula, um caractere especial e um número.',
    }, 400);
  }

  if (!ALLOWED_SERVICE_UNITS.includes(serviceUnit as (typeof ALLOWED_SERVICE_UNITS)[number])) {
    return jsonResponse({
      error: 'Setor de serviço inválido. Escolha entre Jurídico, Administrativo ou Tecnológico/AI.',
    }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Configuração do Supabase incompleta no ambiente' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Regra comercial solicitada:
  // 1) Cadastro inicial sempre na organização padrão
  // 2) Organização solicitada é criada em seguida no sistema
  const { data: organization, error: organizationError } = await admin
    .from('organizations')
    .select('id, slug, name')
    .eq('slug', 'default')
    .maybeSingle();

  if (organizationError || !organization) {
    return jsonResponse({
      error: 'Organização não encontrada para o slug informado',
      details: organizationError?.message,
    }, 400);
  }

  const { data: authCreated, error: authCreateError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: fullName,
      source: 'wix_form',
      service_unit: serviceUnit,
      requested_organization_name: requestedOrganizationName || null,
    },
  });

  if (authCreateError || !authCreated.user) {
    return jsonResponse({
      error: 'Não foi possível criar o usuário de autenticação',
      details: authCreateError?.message,
    }, 400);
  }

  const userId = authCreated.user.id;

  const fullProfilePayload = {
    id: userId,
    nome_completo: fullName,
    email,
    role: 'client',
    org_id: organization.id,
    documento_identidade: documentId || null,
    nif_cpf: taxId || null,
    estado_civil: maritalStatus || null,
    phone: phone || null,
    endereco: address || null,
    pais: country || null,
  };

  const minimalProfilePayload = {
    id: userId,
    nome_completo: fullName,
    email,
    org_id: organization.id,
  };

  const { error: profileError } = await admin
    .from('profiles')
    .upsert(fullProfilePayload, { onConflict: 'id' });

  if (profileError) {
    const { error: fallbackProfileError } = await admin
      .from('profiles')
      .upsert(minimalProfilePayload, { onConflict: 'id' });

    if (fallbackProfileError) {
      return jsonResponse({
        error: 'Usuário criado, mas falhou ao salvar profile',
        details: fallbackProfileError.message,
      }, 400);
    }
  }

  const { error: memberError } = await admin
    .from('org_members')
    .upsert(
      {
        org_id: organization.id,
        user_id: userId,
        role: 'client',
      },
      { onConflict: 'org_id,user_id' },
    );

  if (memberError) {
    return jsonResponse({
      error: 'Usuário criado, mas falhou ao vincular na organização',
      details: memberError.message,
    }, 400);
  }

  let processId: string | null = null;
  const title = (processTitle || '').trim() || `Cadastro via formulário externo - ${fullName}`;

  const { data: processData, error: processError } = await admin
    .from('processes')
    .insert({
      org_id: organization.id,
      titulo: title,
      cliente_nome: fullName,
      cliente_documento: taxId || documentId || null,
      cliente_contato: phone || email,
      responsavel_user_id: userId,
    })
    .select('id')
    .maybeSingle();

  if (!processError && processData?.id) {
    processId = processData.id;

    await admin.from('process_events').insert({
      org_id: organization.id,
      process_id: processId,
      tipo: 'registro',
      mensagem: `Processo criado automaticamente via formulário Wix. Setor escolhido: ${serviceUnit}.`,
      created_by: userId,
    });
  }

  let requestedOrganization: { id: string; slug: string; name: string } | null = null;
  const sanitizedRequestedOrganizationName = requestedOrganizationName.trim();

  if (sanitizedRequestedOrganizationName) {
    const requestedSlug = await generateUniqueOrgSlug(admin, sanitizedRequestedOrganizationName);

    const { data: createdOrganization, error: createOrganizationError } = await admin
      .from('organizations')
      .insert({
        slug: requestedSlug,
        name: sanitizedRequestedOrganizationName,
      })
      .select('id, slug, name')
      .maybeSingle();

    if (!createOrganizationError && createdOrganization) {
      requestedOrganization = createdOrganization;

      await admin
        .from('org_members')
        .upsert(
          {
            org_id: createdOrganization.id,
            user_id: userId,
            role: 'owner',
          },
          { onConflict: 'org_id,user_id' },
        );

      if (processId) {
        await admin.from('process_events').insert({
          org_id: organization.id,
          process_id: processId,
          tipo: 'observacao',
          mensagem: `Organização solicitada criada: ${createdOrganization.name} (${createdOrganization.slug}). Cadastro inicial mantido na organização padrão.`,
          created_by: userId,
        });
      }
    }
  }

  return jsonResponse({
    success: true,
    message: 'Cadastro recebido com sucesso',
    user_id: userId,
    process_id: processId,
    organization: {
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
    },
    service_unit: serviceUnit,
    requested_organization: requestedOrganization,
  });
});
