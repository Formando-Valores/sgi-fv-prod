import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  const scheduledSlot = String(payload.scheduledSlot ?? '').trim();
  const assignedProfessionalName = String(payload.assignedProfessionalName ?? '').trim();
  const assignedAdminId = payload.assignedAdminId ? String(payload.assignedAdminId).trim() : null;
  const clientName = String(payload.clientName ?? '').trim();
  const clientDocument = payload.clientDocument ? String(payload.clientDocument).trim() : null;
  const clientContact = payload.clientContact ? String(payload.clientContact).trim() : null;
  const organizationName = payload.organizationName ? String(payload.organizationName).trim() : null;

  if (!organizationId || !serviceName) {
    return jsonResponse(400, { success: false, error: 'Dados obrigatórios ausentes para criar o processo.' });
  }

  const processTitle = `${serviceName} - ${assignedProfessionalName || 'Profissional a definir'} (${scheduledSlot || 'horário a confirmar'})`;

  try {
    const { data: createdProcess, error: processError } = await adminClient
      .from('processes')
      .insert({
        org_id: organizationId,
        titulo: processTitle,
        status: 'triagem',
        cliente_nome: clientName || 'Cliente',
        cliente_documento: clientDocument,
        cliente_contato: clientContact || null,
        responsavel_user_id: assignedAdminId,
        origem_canal: 'portal_cliente',
        unidade_atendimento: serviceArea || null,
        org_nome_solicitado: organizationName,
      })
      .select('id,created_at')
      .single();

    if (processError || !createdProcess) {
      return jsonResponse(500, { success: false, error: 'Não foi possível criar o processo de atendimento.' });
    }

    await adminClient.from('process_events').insert([
      {
        org_id: organizationId,
        process_id: createdProcess.id,
        tipo: 'registro',
        mensagem: `Atendimento criado após pagamento confirmado. Serviço: ${serviceName}.`,
        created_by: requesterUserId,
      },
      {
        org_id: organizationId,
        process_id: createdProcess.id,
        tipo: 'atribuicao',
        mensagem: `Atribuído inicialmente para ${assignedProfessionalName || 'profissional a definir'}. Continuidade permitida para admins da organização.`,
        created_by: requesterUserId,
      },
    ]);

    return jsonResponse(200, {
      success: true,
      processId: createdProcess.id,
      createdAt: createdProcess.created_at,
    });
  } catch {
    return jsonResponse(500, { success: false, error: 'Erro ao iniciar atendimento. Tente novamente.' });
  }
});
