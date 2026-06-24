import Stripe from 'https://esm.sh/stripe@18.3.0?target=deno';
import { Client } from 'https://deno.land/x/postgres@v0.19.3/mod.ts';

type ProcessRecord = {
  id: string;
  org_id: string;
  responsavel_user_id?: string | null;
  service_id?: string | null;
  selected_service_id?: string | null;
  servico_id?: string | null;
  service_reference?: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
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

const hasTruthyMetadata = (value?: string | null) => Boolean(value && value.trim());

const pickProcessServiceId = (process: ProcessRecord) =>
  process.service_id
  ?? process.selected_service_id
  ?? process.servico_id
  ?? process.service_reference
  ?? null;

const normalizeStripeId = (value: string | Stripe.PaymentIntent | null) => {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
};

const isUuid = (value: string | null | undefined) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

const mapEventToPaymentStatus = (eventType: string): 'paid' | 'failed' | 'canceled' | 'refunded' | null => {
  if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') return 'paid';
  if (eventType === 'payment_intent.payment_failed') return 'failed';
  if (eventType === 'checkout.session.expired' || eventType === 'checkout.session.async_payment_failed') return 'canceled';
  if (eventType === 'charge.refunded' || eventType === 'charge.refund.updated') return 'refunded';
  return null;
};

const mapEventToAuditCode = (eventType: string) => {
  if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') return 'payment_confirmed';
  if (eventType === 'payment_intent.payment_failed') return 'payment_failed';
  if (eventType === 'checkout.session.expired' || eventType === 'checkout.session.async_payment_failed') return 'payment_canceled';
  if (eventType === 'charge.refunded' || eventType === 'charge.refund.updated') return 'payment_refunded';
  return 'payment_updated';
};

const resolveProcessUpdate = (paymentStatus: 'paid' | 'failed' | 'canceled' | 'refunded') => {
  if (paymentStatus === 'paid') {
    return {
      paymentStatus,
      processStatus: 'liberado',
      shouldReleaseProcess: true,
    };
  }

  return {
    paymentStatus,
    processStatus: null,
    shouldReleaseProcess: false,
  };
};

const validateProcessConsistency = (
  process: ProcessRecord,
  metadata: { processId?: string; clientId?: string; serviceId?: string; orgId?: string; organizationId?: string },
) => {
  const metadataOrgId = metadata.orgId ?? metadata.organizationId;

  if (hasTruthyMetadata(metadataOrgId) && metadataOrgId !== process.org_id) {
    throw new Error('Inconsistência entre orgId do metadata e do processo.');
  }

  if (hasTruthyMetadata(metadata.clientId)) {
    const processClientId = process.responsavel_user_id ?? null;
    if (processClientId && processClientId !== metadata.clientId) {
      throw new Error('Inconsistência entre clientId do metadata e do processo.');
    }
  }

  if (hasTruthyMetadata(metadata.serviceId)) {
    const processServiceId = pickProcessServiceId(process);
    if (processServiceId && processServiceId !== metadata.serviceId) {
      throw new Error('Inconsistência entre serviceId do metadata e do processo.');
    }
  }
};

const logAudit = (
  message: string,
  context: Record<string, unknown> & { processId?: string | null; eventId?: string | null; checkoutSessionId?: string | null; paymentIntentId?: string | null },
) => {
  const payload = {
    component: 'stripe-webhook',
    message,
    processId: context.processId ?? null,
    eventId: context.eventId ?? null,
    checkoutSessionId: context.checkoutSessionId ?? null,
    paymentIntentId: context.paymentIntentId ?? null,
    ...context,
  };

  console.log(JSON.stringify(payload));
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Método não permitido.' });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  const dbConnectionString = getDbConnectionString();

  if (!stripeSecretKey || !stripeWebhookSecret) {
    return jsonResponse(500, { success: false, error: 'Credenciais Stripe ausentes.' });
  }

  if (!dbConnectionString) {
    return jsonResponse(500, { success: false, error: 'String de conexão do banco não configurada.' });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return jsonResponse(400, { success: false, error: 'Assinatura Stripe ausente.' });
  }

  const rawBody = await request.text();
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-03-31.basil' });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, stripeWebhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Assinatura do webhook inválida.';
    return jsonResponse(400, { success: false, error: message });
  }

  const actionableStatus = mapEventToPaymentStatus(event.type);
  if (!actionableStatus) {
    logAudit('webhook_received_ignored', { eventId: event.id, eventType: event.type });
    return jsonResponse(200, { success: true, ignored: true, eventType: event.type });
  }

  const client = new Client(dbConnectionString);

  try {
    await client.connect();
    await client.queryArray('BEGIN');

    const idemCheck = await client.queryObject<{ id: string }>(
      'SELECT id FROM public.payments WHERE raw_webhook_event_id = $1 LIMIT 1',
      [event.id],
    );

    if (idemCheck.rows.length > 0) {
      await client.queryArray('COMMIT');
      return jsonResponse(200, { success: true, duplicated: true, eventId: event.id });
    }

    let processId = '';
    let paymentIntentId: string | null = null;
    let checkoutSessionId: string | null = null;
    const metadata: Record<string, string> = {};

    let stripeCustomerId: string | null = null;

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;
      processId = String(session.metadata?.processId ?? '').trim();
      paymentIntentId = normalizeStripeId(session.payment_intent as string | Stripe.PaymentIntent | null);
      checkoutSessionId = session.id;
      stripeCustomerId = typeof session.customer === 'string' ? session.customer : (session.customer as { id?: string } | null)?.id ?? null;
      Object.assign(metadata, session.metadata ?? {});
    }

    if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      processId = String(paymentIntent.metadata?.processId ?? '').trim();
      paymentIntentId = paymentIntent.id;
      checkoutSessionId = String(paymentIntent.metadata?.checkoutSessionId ?? '').trim() || null;
      Object.assign(metadata, paymentIntent.metadata ?? {});
    }

    if (event.type === 'charge.refunded' || event.type === 'charge.refund.updated') {
      const charge = event.data.object as Stripe.Charge;
      processId = String(charge.metadata?.processId ?? '').trim();
      paymentIntentId = normalizeStripeId(charge.payment_intent as string | Stripe.PaymentIntent | null);
      checkoutSessionId = String(charge.metadata?.checkoutSessionId ?? '').trim() || null;
      Object.assign(metadata, charge.metadata ?? {});
    }

    if (!processId) {
      throw new Error('processId ausente no metadata do evento Stripe.');
    }

    const processResult = await client.queryObject<ProcessRecord>(
      `SELECT id, org_id, responsavel_user_id, service_id, selected_service_id, servico_id, service_reference
         FROM public.processes
        WHERE id = $1
        LIMIT 1
        FOR UPDATE`,
      [processId],
    );

    const process = processResult.rows[0];
    if (!process) {
      throw new Error('Processo não encontrado para o processId informado.');
    }

    validateProcessConsistency(process, {
      processId,
      clientId: metadata.clientId,
      serviceId: metadata.serviceId,
      orgId: metadata.orgId,
      organizationId: metadata.organizationId,
    });

    const expectedClientId = process.responsavel_user_id ?? null;
    const metadataClientId = String(metadata.clientId ?? '').trim();
    const validatedClientId = isUuid(metadataClientId)
      ? metadataClientId
      : isUuid(expectedClientId)
        ? expectedClientId
        : null;

    const paymentUpdate = await client.queryObject<{ id: string }>(
      `UPDATE public.payments
          SET status = $2,
              payment_provider = 'stripe',
              paid_at = CASE WHEN $2 = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
              stripe_checkout_session_id = COALESCE($3, stripe_checkout_session_id),
              stripe_payment_intent_id = COALESCE($4, stripe_payment_intent_id),
              stripe_customer_id = COALESCE($9, stripe_customer_id),
              raw_webhook_event_id = $5,
              last_event_type = $6,
              last_event_at = now(),
              updated_at = now()
        WHERE process_id = $1
          AND ($7::uuid IS NULL OR client_id = $7::uuid)
        RETURNING id`,
      [processId, actionableStatus, checkoutSessionId, paymentIntentId, event.id, event.type, validatedClientId, null, stripeCustomerId],
    );

    if (paymentUpdate.rows.length === 0) {
      throw new Error('Pagamento não encontrado para o processId informado.');
    }

    const processUpdate = resolveProcessUpdate(actionableStatus);

    if (processUpdate.shouldReleaseProcess) {
      await client.queryObject(
        `UPDATE public.processes
            SET payment_status = $2,
                process_status = $3,
                usage_deadline_at = COALESCE(
                  CASE
                    WHEN data_prazo IS NOT NULL THEN (data_prazo::timestamp + interval '23 hours 59 minutes 59 seconds')
                    ELSE NULL
                  END,
                  usage_deadline_at,
                  now() + interval '30 days'
                ),
                updated_at = now()
          WHERE id = $1`,
        [processId, processUpdate.paymentStatus, processUpdate.processStatus],
      );
    } else {
      await client.queryObject(
        `UPDATE public.processes
            SET payment_status = $2,
                usage_deadline_at = CASE
                  WHEN $2 = 'paid' THEN COALESCE(
                    CASE
                      WHEN data_prazo IS NOT NULL THEN (data_prazo::timestamp + interval '23 hours 59 minutes 59 seconds')
                      ELSE NULL
                    END,
                    usage_deadline_at,
                    now() + interval '30 days'
                  )
                  ELSE usage_deadline_at
                END,
                updated_at = now()
          WHERE id = $1`,
        [processId, processUpdate.paymentStatus],
      );
    }

    const baseMessage = `Webhook Stripe processado (${event.type}). payment_status=${actionableStatus}.`;
    const detailMessage = `event_id=${event.id}; checkout_session_id=${checkoutSessionId ?? '-'}; payment_intent_id=${paymentIntentId ?? '-'}.`;

    await client.queryObject(
      `INSERT INTO public.process_events (
         org_id, process_id, tipo, mensagem,
         correlation_process_id, correlation_checkout_session_id, correlation_stripe_event_id, event_code
       )
       VALUES
         ($1, $2, 'status_change', $3, $2, $4, $5, 'webhook_received'),
         ($1, $2, 'status_change', $6, $2, $4, $5, 'webhook_validated'),
         ($1, $2, 'status_change', $7, $2, $4, $5, $8)`,
      [
        process.org_id,
        processId,
        `Webhook recebido (${event.type}). stripeEventId=${event.id}.`,
        checkoutSessionId,
        event.id,
        `Webhook validado (${event.type}). stripeEventId=${event.id}.`,
        `${baseMessage} ${detailMessage}`,
        mapEventToAuditCode(event.type),
      ],
    );

    if (processUpdate.shouldReleaseProcess) {
      await client.queryObject(
        `INSERT INTO public.process_events (
           org_id, process_id, tipo, mensagem,
           correlation_process_id, correlation_checkout_session_id, correlation_stripe_event_id, event_code
         ) VALUES ($1, $2, 'status_change', $3, $2, $4, $5, 'process_released')`,
        [
          process.org_id,
          processId,
          `Processo liberado após confirmação de pagamento. stripeEventId=${event.id}.`,
          checkoutSessionId,
          event.id,
        ],
      );
    }

    const syncCheck = await client.queryObject<{ process_payment_status: string | null; payment_status: string | null }>(
      `SELECT pr.payment_status AS process_payment_status, pay.status AS payment_status
         FROM public.processes pr
         JOIN public.payments pay ON pay.process_id = pr.id
        WHERE pr.id = $1
        LIMIT 1`,
      [processId],
    );

    const syncRow = syncCheck.rows[0];
    if (!syncRow || syncRow.process_payment_status !== syncRow.payment_status) {
      throw new Error('Inconsistência pós-webhook: processes.payment_status diverge de payments.status.');
    }

    await client.queryArray('COMMIT');
    logAudit('webhook_processed', {
      processId,
      eventId: event.id,
      checkoutSessionId,
      paymentIntentId,
      paymentStatus: actionableStatus,
      eventType: event.type,
    });

    return jsonResponse(200, {
      success: true,
      eventId: event.id,
      processId,
      paymentStatus: actionableStatus,
    });
  } catch (error) {
    await client.queryArray('ROLLBACK').catch(() => undefined);
    const message = error instanceof Error ? error.message : 'Falha ao processar webhook Stripe.';
    logAudit('webhook_processing_failed', { error: message, eventId: event?.id ?? null });
    return jsonResponse(500, { success: false, error: message });
  } finally {
    await client.end().catch(() => undefined);
  }
});
