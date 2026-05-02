import { Client } from 'https://deno.land/x/postgres@v0.19.3/mod.ts';
import { StripePaymentProvider } from '../_shared/payments/stripeProvider.ts';

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

type ProcessOwnershipRow = {
  id: string;
  org_id: string;
  responsavel_user_id?: string | null;
};

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

const getDbConnectionString = () =>
  Deno.env.get('SUPABASE_DB_URL')
    ?? Deno.env.get('POSTGRES_URL')
    ?? Deno.env.get('DATABASE_URL')
    ?? '';

const logAudit = (message: string, context: Record<string, unknown>) => {
  console.log(`[stripe-checkout] ${message}`, JSON.stringify(context));
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { success: false, error: 'Método não permitido.' });

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const dbConnectionString = getDbConnectionString();

  if (!stripeSecretKey) return jsonResponse(500, { success: false, error: 'STRIPE_SECRET_KEY não configurada.' });
  if (!dbConnectionString) return jsonResponse(500, { success: false, error: 'String de conexão do banco não configurada.' });

  const payload = (await request.json().catch(() => ({}))) as CheckoutPayload;
  const amount = Number(payload.amount ?? 0);
  const currency = String(payload.currency ?? 'brl').trim().toLowerCase();
  const successUrl = String(payload.successUrl ?? '').trim();
  const cancelUrl = String(payload.cancelUrl ?? '').trim();

  if (!Number.isFinite(amount) || amount <= 0) return jsonResponse(400, { success: false, error: 'amount deve ser um número positivo (centavos).' });
  if (!currency) return jsonResponse(400, { success: false, error: 'currency é obrigatório.' });
  if (!successUrl || !cancelUrl) return jsonResponse(400, { success: false, error: 'successUrl e cancelUrl são obrigatórios.' });

  const processId = String(payload.processId ?? '').trim();
  const clientId = String(payload.clientId ?? '').trim();
  const organizationId = String(payload.organizationId ?? '').trim();
  const serviceId = String(payload.serviceId ?? '').trim();

  if (!processId || !clientId || !organizationId) {
    return jsonResponse(400, { success: false, error: 'processId, clientId e organizationId são obrigatórios.' });
  }

  const provider = new StripePaymentProvider(stripeSecretKey);
  const client = new Client(dbConnectionString);

  try {
    await client.connect();
    await client.queryArray('BEGIN');

    const processOwnership = await client.queryObject<ProcessOwnershipRow>(
      `SELECT id, org_id, responsavel_user_id
         FROM public.processes
        WHERE id = $1
          AND org_id = $2
        LIMIT 1`,
      [processId, organizationId],
    );

    const process = processOwnership.rows[0];
    if (!process) throw new Error('Processo não encontrado para o organizationId informado.');

    const expectedClientId = process.responsavel_user_id ?? null;
    if (expectedClientId && expectedClientId !== clientId) throw new Error('clientId divergente do cliente vinculado ao processo.');

    const checkout = await provider.createCheckout({
      amountInCents: amount,
      currency,
      successUrl,
      cancelUrl,
      processId,
      clientId,
      serviceId,
      organizationId,
      areaId: String(payload.areaId ?? ''),
      sectorId: String(payload.sectorId ?? ''),
    });

    await client.queryObject(
      `INSERT INTO public.payments (
         process_id, client_id, amount, currency, status,
         payment_provider, payment_method, stripe_checkout_session_id,
         last_event_type, last_event_at, updated_at
       ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, 'checkout.session.created', now(), now())
       ON CONFLICT (process_id) DO UPDATE
       SET amount = EXCLUDED.amount,
           currency = EXCLUDED.currency,
           status = 'pending',
           payment_provider = EXCLUDED.payment_provider,
           payment_method = EXCLUDED.payment_method,
           stripe_checkout_session_id = EXCLUDED.stripe_checkout_session_id,
           last_event_type = 'checkout.session.created',
           last_event_at = now(),
           updated_at = now()`,
      [processId, clientId, amount / 100, currency.toUpperCase(), checkout.provider, checkout.paymentMethod, checkout.sessionId],
    );

    await client.queryObject(
      `INSERT INTO public.process_events (
         org_id, process_id, tipo, mensagem,
         correlation_process_id, correlation_checkout_session_id, correlation_stripe_event_id, event_code
       ) VALUES
         ($1, $2, 'status_change', $3, $2, $4, NULL, 'checkout_session_created'),
         ($1, $2, 'status_change', $5, $2, $4, NULL, 'client_redirected')`,
      [
        organizationId,
        processId,
        `Checkout session criada. checkoutSessionId=${checkout.sessionId}.`,
        checkout.sessionId,
        `Cliente redirecionado para checkout Stripe. checkoutSessionId=${checkout.sessionId}.`,
      ],
    );

    await client.queryArray('COMMIT');
    logAudit('checkout_created_and_redirect_logged', { processId, checkoutSessionId: checkout.sessionId, clientId });

    return jsonResponse(200, { success: true, sessionId: checkout.sessionId, url: checkout.url });
  } catch (error) {
    await client.queryArray('ROLLBACK').catch(() => undefined);
    const message = error instanceof Error ? error.message : 'Erro ao criar sessão de checkout.';
    logAudit('checkout_creation_failed', { processId, clientId, error: message });
    return jsonResponse(500, { success: false, error: message });
  } finally {
    await client.end().catch(() => undefined);
  }
});
