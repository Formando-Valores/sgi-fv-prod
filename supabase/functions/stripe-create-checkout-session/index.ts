import Stripe from 'https://esm.sh/stripe@18.3.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type CheckoutPayload = {
  amount?: number;
  currency?: string;
  successUrl?: string;
  cancelUrl?: string;
  processId?: string;
  clientId?: string;
  serviceId?: string;
  organizationId?: string;
  areaId?: string;
  sectorId?: string;
};

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

const logAudit = (message: string, context: Record<string, unknown>) => {
  console.log(`[stripe-checkout] ${message}`, JSON.stringify(context));
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Método não permitido.' });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!stripeSecretKey) {
    return jsonResponse(500, { success: false, error: 'STRIPE_SECRET_KEY não configurada.' });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { success: false, error: 'SUPABASE_URL ou SERVICE_ROLE_KEY não configurados.' });
  }

  const payload = (await request.json().catch(() => ({}))) as CheckoutPayload;

  const amount = Number(payload.amount ?? 0);
  const currency = String(payload.currency ?? 'brl').trim().toLowerCase();
  const successUrl = String(payload.successUrl ?? '').trim();
  const cancelUrl = String(payload.cancelUrl ?? '').trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonResponse(400, { success: false, error: 'amount deve ser um número positivo (centavos).' });
  }

  if (!currency) {
    return jsonResponse(400, { success: false, error: 'currency é obrigatório.' });
  }

  if (!successUrl || !cancelUrl) {
    return jsonResponse(400, { success: false, error: 'successUrl e cancelUrl são obrigatórios.' });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-03-31.basil',
  });

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const processId = String(payload.processId ?? '').trim();
  const clientId = String(payload.clientId ?? '').trim();
  const organizationId = String(payload.organizationId ?? '').trim();
  const serviceId = String(payload.serviceId ?? '').trim();

  if (!processId || !clientId || !organizationId) {
    return jsonResponse(400, { success: false, error: 'processId, clientId e organizationId são obrigatórios.' });
  }

  try {
    const { data: process, error: processError } = await supabase
      .from('processes')
      .select('id, org_id, responsavel_user_id')
      .eq('id', processId)
      .eq('org_id', organizationId)
      .single();

    if (processError || !process) {
      throw new Error(processError?.message ?? 'Processo não encontrado para o organizationId informado.');
    }

    const expectedClientId = process.responsavel_user_id ?? null;
    if (expectedClientId && expectedClientId !== clientId) {
      throw new Error('clientId divergente do cliente vinculado ao processo.');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_creation: 'always',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: Math.round(amount),
            product_data: {
              name: 'Serviço SGI FV',
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        processId,
        clientId,
        serviceId,
        organizationId,
        areaId: String(payload.areaId ?? ''),
        sectorId: String(payload.sectorId ?? ''),
      },
    });

    const stripeCustomerId = typeof session.customer === 'string'
      ? session.customer
      : (session.customer as { id?: string } | null)?.id ?? null;

    const now = new Date().toISOString();

    const { error: paymentError } = await supabase
      .from('payments')
      .upsert({
        process_id: processId,
        client_id: clientId,
        amount: amount / 100,
        currency: currency.toUpperCase(),
        status: 'pending',
        payment_provider: 'stripe',
        payment_method: 'stripe_checkout',
        stripe_checkout_session_id: session.id,
        stripe_customer_id: stripeCustomerId,
        last_event_type: 'checkout.session.created',
        last_event_at: now,
        updated_at: now,
        created_at: now,
      }, { onConflict: 'process_id' });

    if (paymentError) {
      throw new Error(`Erro ao inserir/atualizar payment: ${paymentError.message}`);
    }

    const { error: eventsError } = await supabase
      .from('process_events')
      .insert([
        {
          org_id: organizationId,
          process_id: processId,
          tipo: 'status_change',
          mensagem: `Checkout session criada. checkoutSessionId=${session.id}.`,
          correlation_process_id: processId,
          correlation_checkout_session_id: session.id,
          correlation_stripe_event_id: null,
          event_code: 'checkout_session_created',
        },
        {
          org_id: organizationId,
          process_id: processId,
          tipo: 'status_change',
          mensagem: `Cliente redirecionado para checkout Stripe. checkoutSessionId=${session.id}.`,
          correlation_process_id: processId,
          correlation_checkout_session_id: session.id,
          correlation_stripe_event_id: null,
          event_code: 'client_redirected',
        },
      ]);

    if (eventsError) {
      logAudit('process_events_insert_failed', { processId, error: eventsError.message });
    }

    logAudit('checkout_created_and_redirect_logged', { processId, checkoutSessionId: session.id, clientId });

    return jsonResponse(200, {
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar sessão de checkout.';
    logAudit('checkout_creation_failed', { processId, clientId, error: message });
    return jsonResponse(500, { success: false, error: message });
  }
});
