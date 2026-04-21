import { Client } from 'https://deno.land/x/postgres@v0.19.3/mod.ts';
import { StripePaymentProvider } from '../_shared/payments/stripeProvider.ts';
import { mapEventToAuditCode, resolveProcessUpdate } from '../_shared/payments/status.ts';

type ProcessRecord = {
  id: string;
  org_id: string;
  client_user_id?: string | null;
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

const validateProcessConsistency = (
  process: ProcessRecord,
  metadata: { processId?: string; clientId?: string; serviceId?: string; orgId?: string; organizationId?: string },
) => {
  const metadataOrgId = metadata.orgId ?? metadata.organizationId;

  if (hasTruthyMetadata(metadataOrgId) && metadataOrgId !== process.org_id) {
    throw new Error('Inconsistência entre orgId do metadata e do processo.');
  }

  if (hasTruthyMetadata(metadata.clientId)) {
    const processClientId = process.client_user_id ?? process.responsavel_user_id ?? null;
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

const logAudit = (message: string, context: Record<string, unknown>) => {
  console.log(`[stripe-webhook] ${message}`, JSON.stringify(context));
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Método não permitido.' });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const dbConnectionString = getDbConnectionString();

  if (!stripeSecretKey) {
    return jsonResponse(500, { success: false, error: 'STRIPE_SECRET_KEY ausente.' });
  }

  if (!dbConnectionString) {
    return jsonResponse(500, { success: false, error: 'String de conexão do banco não configurada.' });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return jsonResponse(400, { success: false, error: 'Assinatura Stripe ausente.' });
  }

  const rawBody = await request.text();
  const provider = new StripePaymentProvider(stripeSecretKey);

  let webhookEvent;
  try {
    webhookEvent = await provider.interpretWebhook(rawBody, signature);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Assinatura do webhook inválida.';
    return jsonResponse(400, { success: false, error: message });
  }

  if (!webhookEvent) {
    logAudit('webhook_received_ignored', { eventType: 'not-actionable' });
    return jsonResponse(200, { success: true, ignored: true });
  }

  const client = new Client(dbConnectionString);

  try {
    await client.connect();
    await client.queryArray('BEGIN');

    const idemCheck = await client.queryObject<{ id: string }>(
      'SELECT id FROM public.payments WHERE raw_webhook_event_id = $1 LIMIT 1',
      [webhookEvent.eventId],
    );

    if (idemCheck.rows.length > 0) {
      await client.queryArray('COMMIT');
      return jsonResponse(200, { success: true, duplicated: true, eventId: webhookEvent.eventId });
    }

    const { processId, paymentIntentId, checkoutSessionId, metadata } = webhookEvent;

    if (!processId) {
      throw new Error('processId ausente no metadata do evento Stripe.');
    }

    const processResult = await client.queryObject<ProcessRecord>(
      `SELECT id, org_id, client_user_id, responsavel_user_id, service_id, selected_service_id, servico_id, service_reference
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

    const paymentUpdate = await client.queryObject<{ id: string }>(
      `UPDATE public.payments
          SET status = $2,
              payment_provider = 'stripe',
              paid_at = CASE WHEN $2 = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
              stripe_checkout_session_id = COALESCE($3, stripe_checkout_session_id),
              stripe_payment_intent_id = COALESCE($4, stripe_payment_intent_id),
              raw_webhook_event_id = $5,
              last_event_type = $6,
              last_event_at = now(),
              updated_at = now()
        WHERE process_id = $1
        RETURNING id`,
      [processId, webhookEvent.paymentStatus, checkoutSessionId, paymentIntentId, webhookEvent.eventId, webhookEvent.eventType],
    );

    if (paymentUpdate.rows.length === 0) {
      throw new Error('Pagamento não encontrado para o processId informado.');
    }

    const processUpdate = resolveProcessUpdate(webhookEvent.paymentStatus);

    if (processUpdate.shouldReleaseProcess) {
      await client.queryObject(
        `UPDATE public.processes
            SET payment_status = $2,
                process_status = $3,
                updated_at = now()
          WHERE id = $1`,
        [processId, processUpdate.paymentStatus, processUpdate.processStatus],
      );
    } else {
      await client.queryObject(
        `UPDATE public.processes
            SET payment_status = $2,
                updated_at = now()
          WHERE id = $1`,
        [processId, processUpdate.paymentStatus],
      );
    }

    const baseMessage = `Webhook Stripe processado (${webhookEvent.eventType}). payment_status=${webhookEvent.paymentStatus}.`;
    const detailMessage = `event_id=${webhookEvent.eventId}; checkout_session_id=${checkoutSessionId ?? '-'}; payment_intent_id=${paymentIntentId ?? '-'}.`;

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
        `Webhook recebido (${webhookEvent.eventType}). stripeEventId=${webhookEvent.eventId}.`,
        checkoutSessionId,
        webhookEvent.eventId,
        `Webhook validado (${webhookEvent.eventType}). stripeEventId=${webhookEvent.eventId}.`,
        `${baseMessage} ${detailMessage}`,
        mapEventToAuditCode(webhookEvent.eventType),
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
          `Processo liberado após confirmação de pagamento. stripeEventId=${webhookEvent.eventId}.`,
          checkoutSessionId,
          webhookEvent.eventId,
        ],
      );
    }

    await client.queryArray('COMMIT');
    logAudit('webhook_processed', {
      processId,
      stripeEventId: webhookEvent.eventId,
      checkoutSessionId,
      paymentIntentId,
      paymentStatus: webhookEvent.paymentStatus,
    });

    return jsonResponse(200, {
      success: true,
      eventId: webhookEvent.eventId,
      processId,
      paymentStatus: webhookEvent.paymentStatus,
    });
  } catch (error) {
    await client.queryArray('ROLLBACK').catch(() => undefined);
    const message = error instanceof Error ? error.message : 'Falha ao processar webhook Stripe.';
    logAudit('webhook_processing_failed', { stripeEventId: webhookEvent?.eventId ?? null, error: message });
    return jsonResponse(500, { success: false, error: message });
  } finally {
    await client.end().catch(() => undefined);
  }
});
