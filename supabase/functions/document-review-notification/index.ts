import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    const payload = await req.json();
    const reason = payload?.reason || payload?.justification || payload?.guidance || 'Documento recusado. Reenvio necessário.';
    const processTitle = payload?.process?.titulo || payload?.process_id || 'Processo';
    const customerName = payload?.process?.cliente_nome || 'Cliente';

    console.log('[document-review-notification] Dispatching email workflow', {
      processId: payload?.process_id,
      decision: payload?.decision,
      actorUserId: payload?.actor_user_id,
      timestamp: new Date().toISOString(),
      reason,
    });

    // Aqui seria integrada a chamada ao provedor de e-mail/transacional.
    return new Response(
      JSON.stringify({
        success: true,
        message: `Notificação preparada para ${customerName} sobre ${processTitle}.`,
        reason,
        instructions: payload?.guidance || 'Revise a justificativa e reenvie o documento solicitado no portal.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
