import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const supabaseUrl = Deno.env.get('URL_SUPABASE') ?? Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY_SUPABASE') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { success: false, error: 'Configuração do Supabase ausente na Edge Function.' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authHeader = request.headers.get('Authorization') || '';
  const accessToken = authHeader.replace('Bearer', '').trim();
  let requesterUserId: string | null = null;

  if (accessToken) {
    const { data: authData } = await adminClient.auth.getUser(accessToken);
    requesterUserId = authData.user?.id ?? null;
  }

  const payload = await request.json().catch(() => ({}));
  const organizationId = String(payload.organizationId ?? '').trim();
  const serviceName = String(payload.serviceName ?? '').trim();
  const serviceArea = String(payload.serviceArea ?? '').trim();
  const serviceId = payload.serviceId ? String(payload.serviceId).trim() : null;
  const scheduledSlot = String(payload.scheduledSlot ?? '').trim();
  const assignedProfessionalName = String(payload.assignedProfessionalName ?? '').trim();
  const amount = Number(payload.amount ?? 0);
  const normalizedAmount = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
  const clientName = String(payload.clientName ?? '').trim();
  const clientDocument = payload.clientDocument ? String(payload.clientDocument).trim() : null;
  const clientContact = payload.clientContact ? String(payload.clientContact).trim() : null;
  const clientEmail = payload.clientEmail ? String(payload.clientEmail).trim().toLowerCase() : null;
  const clientUserId = payload.clientUserId ? String(payload.clientUserId).trim() : null;
  const organizationName = payload.organizationName ? String(payload.organizationName).trim() : null;

  const normalizedRequesterUserId = requesterUserId && UUID_PATTERN.test(requesterUserId)
    ? requesterUserId
    : null;
  const normalizedClientUserId = clientUserId && UUID_PATTERN.test(clientUserId)
    ? clientUserId
    : normalizedRequesterUserId;

  if (!requesterUserId && normalizedClientUserId) {
    requesterUserId = normalizedClientUserId;
  }

  if (!organizationId || !serviceName) {
    return jsonResponse(400, { success: false, error: 'Dados obrigatórios ausentes para criar o processo.' });
  }

  const processTitle = `${serviceName} - ${assignedProfessionalName || 'Profissional a definir'} (${scheduledSlot || 'horário a confirmar'})`;

  try {
    const { data: processColumnsData } = await adminClient
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'processes');

    const processColumns = new Set((processColumnsData ?? []).map((column) => String(column.column_name)));

    const processStatusValue = 'pending_payment';
    const paymentStatusValue = 'pending';

    if (normalizedClientUserId) {
      const { data: existingMember } = await adminClient
        .from('org_members')
        .select('id')
        .eq('org_id', organizationId)
        .eq('user_id', normalizedClientUserId)
        .limit(1)
        .maybeSingle();

      if (!existingMember) {
        await adminClient.from('org_members').insert({
          org_id: organizationId,
          user_id: normalizedClientUserId,
          role: 'client',
        });
      }
    }

    const processInsert: Record<string, unknown> = {
      org_id: organizationId,
      titulo: processTitle,
      cliente_nome: clientName || 'Cliente',
      cliente_documento: clientDocument,
      cliente_contato: clientEmail || clientContact || null,
      responsavel_user_id: normalizedClientUserId,
      cliente_user_id: normalizedClientUserId,
      origem_canal: 'portal_cliente',
      unidade_atendimento: serviceArea || null,
      org_nome_solicitado: organizationName,
    };

    if (processColumns.has('process_status')) {
      processInsert.process_status = processStatusValue;
    } else if (processColumns.has('status')) {
      processInsert.status = 'cadastro';
    }

    if (processColumns.has('payment_status')) {
      processInsert.payment_status = paymentStatusValue;
    }

    if (normalizedAmount !== null) {
      if (processColumns.has('amount')) processInsert.amount = normalizedAmount;
      if (processColumns.has('valor')) processInsert.valor = normalizedAmount;
      if (processColumns.has('valor_centavos')) processInsert.valor_centavos = normalizedAmount;
      if (processColumns.has('checkout_amount')) processInsert.checkout_amount = normalizedAmount;
    }

    if (serviceId) {
      if (processColumns.has('service_id')) processInsert.service_id = serviceId;
      if (processColumns.has('selected_service_id')) processInsert.selected_service_id = serviceId;
      if (processColumns.has('servico_id')) processInsert.servico_id = serviceId;
      if (processColumns.has('service_reference')) processInsert.service_reference = serviceId;
    }

    const { data: createdProcess, error: processError } = await adminClient
      .from('processes')
      .insert(processInsert)
      .select('id,created_at,status,process_status,payment_status')
      .single();

    if (processError || !createdProcess) {
      return jsonResponse(500, { success: false, error: 'Não foi possível criar o processo de atendimento.' });
    }

    await adminClient.from('process_events').insert([
      {
        org_id: organizationId,
        process_id: createdProcess.id,
        tipo: 'registro',
        mensagem: `Solicitação criada; aguardando confirmação de pagamento. Serviço: ${serviceName}. Referência: ${serviceId || 'não informada'}. Valor: ${normalizedAmount ?? 'não informado'}.`,
        created_by: requesterUserId,
      },
      {
        org_id: organizationId,
        process_id: createdProcess.id,
        tipo: 'atribuicao',
        mensagem: `Atribuído inicialmente para ${assignedProfessionalName || 'profissional a definir'}. Continuidade permitida para admins da organização.`,
        created_by: requesterUserId,
      },
      {
        org_id: organizationId,
        process_id: createdProcess.id,
        tipo: 'registro',
        mensagem: `Vínculo cliente registrado: ${clientUserId || 'não informado'} (${clientEmail || clientContact || 'contato não informado'}).`,
        created_by: requesterUserId,
      },
    ]);

    return jsonResponse(200, {
      success: true,
      processId: createdProcess.id,
      status: createdProcess.process_status ?? createdProcess.status ?? processStatusValue,
      paymentStatus: createdProcess.payment_status ?? paymentStatusValue,
      createdAt: createdProcess.created_at,
    });
  } catch {
    return jsonResponse(500, { success: false, error: 'Erro ao iniciar atendimento. Tente novamente.' });
  }
});
