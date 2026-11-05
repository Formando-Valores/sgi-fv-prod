import Stripe from 'https://esm.sh/stripe@18.3.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getOrgStripeConfig } from '../_shared/payments/getOrgStripeConfig.ts';
import { amountToMinorUnits, computeProcessAmountBRL, DEFAULT_ALLOWED_CHECKOUT_ORIGINS, DEFAULT_APP_ORIGIN, safeRedirectUrl } from '../_shared/pricing.ts';

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

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { success: false, error: 'SUPABASE_URL ou SERVICE_ROLE_KEY não configurados.' });
  }

  const payload = (await request.json().catch(() => ({}))) as CheckoutPayload;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const processId = String(payload.processId ?? '').trim();
  if (!processId) {
    return jsonResponse(400, { success: false, error: 'processId é obrigatório.' });
  }

  // MISSÃO 002 / R-05: o processo é a fonte da verdade (org, cliente e VALOR).
  const { data: process, error: processError } = await supabase
    .from('processes')
    .select('id, org_id, cliente_user_id, os_value, amount, payment_status')
    .eq('id', processId)
    .maybeSingle();

  if (processError || !process) {
    return jsonResponse(404, { success: false, error: 'Processo não encontrado.' });
  }

  const organizationId = String(process.org_id ?? '').trim();
  const requestedOrg = String(payload.organizationId ?? '').trim();
  if (requestedOrg && requestedOrg !== organizationId) {
    return jsonResponse(400, { success: false, error: 'organizationId não corresponde ao processo.' });
  }

  if (String(process.payment_status ?? '').toLowerCase() === 'paid') {
    return jsonResponse(409, { success: false, error: 'Este processo já está pago.' });
  }
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('status')
    .eq('process_id', processId)
    .maybeSingle();
  if (String(existingPayment?.status ?? '').toLowerCase() === 'paid') {
    return jsonResponse(409, { success: false, error: 'Este processo já está pago.' });
  }

  // Fetch org-specific Stripe config (falls back to env vars)
  const orgConfig = await getOrgStripeConfig(organizationId, supabaseUrl, serviceRoleKey);
  const resolvedSecretKey = orgConfig.stripeSecretKey || stripeSecretKey;

  if (!resolvedSecretKey) {
    return jsonResponse(500, { success: false, error: 'STRIPE_SECRET_KEY não configurada.' });
  }

  const currency = String(payload.currency || orgConfig.defaultCurrency || 'eur').trim().toLowerCase();
  const allowedCurrencies = orgConfig.allowedCurrencies.map((c) => c.toLowerCase());
  if (allowedCurrencies.length > 0 && !allowedCurrencies.includes(currency)) {
    return jsonResponse(400, {
      success: false,
      error: `Moeda "${currency}" não permitida para esta organização. Permitidas: ${allowedCurrencies.join(', ')}.`,
    });
  }

  // Valor calculado no SERVIDOR a partir do processo (BRL) — o "amount" do navegador é ignorado.
  const amountBRL = computeProcessAmountBRL(process);
  const amount = amountToMinorUnits(amountBRL, currency);
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonResponse(400, { success: false, error: 'Valor do pagamento não definido para este processo.' });
  }
  const clientAmount = Number(payload.amount ?? 0);
  if (clientAmount > 0 && Math.round(clientAmount) !== amount) {
    logAudit('client_amount_ignored', { processId, clientAmount, serverAmount: amount, currency });
  }

  const appUrl = (Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? DEFAULT_APP_ORIGIN).replace(/\/$/, '');
  const allowedOrigins = [
    appUrl,
    ...DEFAULT_ALLOWED_CHECKOUT_ORIGINS,
    Deno.env.get('SITE_URL') ?? '',
    ...String(Deno.env.get('ALLOWED_CHECKOUT_ORIGINS') ?? '').split(',').map((o) => o.trim()),
  ].filter(Boolean);
  const successUrl = safeRedirectUrl(String(payload.successUrl ?? ''), allowedOrigins, `${appUrl}/#/payments/success?processId=${processId}`);
  const cancelUrl = safeRedirectUrl(String(payload.cancelUrl ?? ''), allowedOrigins, `${appUrl}/#/payments/cancel?processId=${processId}`);

  const stripe = new Stripe(resolvedSecretKey, {
    apiVersion: orgConfig.apiVersion as '2025-03-31.basil',
  });

  // O pagador é o cliente do processo; clientId do payload só é usado se o processo não tiver cliente.
  const clientId = String(process.cliente_user_id ?? payload.clientId ?? '').trim();
  const serviceId = String(payload.serviceId ?? '').trim();

  if (!clientId) {
    return jsonResponse(400, { success: false, error: 'Processo sem cliente vinculado.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_creation: 'always',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amount,
            product_data: {
              name: orgConfig.checkoutProductName,
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
        // valor esperado (unidades mínimas) — conferido pelo stripe-webhook
        expectedAmount: String(amount),
        expectedCurrency: currency,
      },
      payment_intent_data: {
        metadata: { processId, organizationId, expectedAmount: String(amount), expectedCurrency: currency },
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
          event_type: 'payment_checkout_created',
          actor_user_id: clientId,
          metadata: { amount_minor: amount, currency },
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
          event_type: 'payment_client_redirected',
          actor_user_id: clientId,
        },
      ]);

    if (eventsError) {
      logAudit('process_events_insert_failed', { processId, error: eventsError.message });
    }

    logAudit('checkout_created_and_redirect_logged', { processId, checkoutSessionId: session.id, clientId, amount, currency });

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
