import Stripe from 'https://esm.sh/stripe@18.3.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ProcessRecord = {
  id: string;
  org_id: string;
  responsavel_user_id?: string | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const hasTruthyMetadata = (value?: string | null) => Boolean(value && value.trim());

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
    return { paymentStatus, processStatus: 'liberado', shouldReleaseProcess: true };
  }
  return { paymentStatus, processStatus: null, shouldReleaseProcess: false };
};

const validateProcessConsistency = (
  process: ProcessRecord,
  metadata: { processId?: string; clientId?: string; orgId?: string; organizationId?: string },
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
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!stripeSecretKey || !stripeWebhookSecret) {
    return jsonResponse(500, { success: false, error: 'Credenciais Stripe ausentes.' });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { success: false, error: 'SUPABASE_URL ou SERVICE_ROLE_KEY não configurados.' });
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

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: existingPayment, error: idemError } = await supabase
      .from('payments')
      .select('id')
      .eq('raw_webhook_event_id', event.id)
      .maybeSingle();

    if (idemError) {
      throw new Error(`Erro na verificação de idempotência: ${idemError.message}`);
    }

    if (existingPayment) {
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
      checkoutSessionId = String(paymentIntent.metadata?.checkoutSessionId ?? '').trim()
        || (paymentIntent.payment_details as Record<string, unknown> | null)?.order_reference as string | null
        || null;
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
      if (paymentIntentId && checkoutSessionId) {
        const { data: existingBySession } = await supabase
          .from('payments')
          .select('process_id')
          .eq('stripe_checkout_session_id', checkoutSessionId)
          .maybeSingle();
        if (existingBySession?.process_id) {
          processId = existingBySession.process_id;
        }
      }
      if (paymentIntentId && !processId) {
        const { data: existingByPi } = await supabase
          .from('payments')
          .select('process_id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle();
        if (existingByPi?.process_id) {
          processId = existingByPi.process_id;
        }
      }
      if (!processId) {
        throw new Error('processId ausente no metadata do evento Stripe.');
      }
    }

    const { data: process, error: processError } = await supabase
      .from('processes')
      .select('id, org_id, responsavel_user_id')
      .eq('id', processId)
      .single();

    if (processError || !process) {
      throw new Error(processError?.message ?? 'Processo não encontrado para o processId informado.');
    }

    validateProcessConsistency(process, {
      processId,
      clientId: metadata.clientId,
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

    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = {
      status: actionableStatus,
      payment_provider: 'stripe',
      stripe_checkout_session_id: checkoutSessionId,
      stripe_payment_intent_id: paymentIntentId,
      stripe_customer_id: stripeCustomerId,
      raw_webhook_event_id: event.id,
      last_event_type: event.type,
      last_event_at: now,
      updated_at: now,
    };

    if (actionableStatus === 'paid') {
      updateData.paid_at = now;
    }

    const paymentQuery = supabase
      .from('payments')
      .update(updateData)
      .eq('process_id', processId);

    if (validatedClientId) {
      paymentQuery.eq('client_id', validatedClientId);
    }

    const { data: paymentRows, error: paymentUpdateError } = await paymentQuery.select('id');

    if (paymentUpdateError) {
      throw new Error(`Erro ao atualizar payment: ${paymentUpdateError.message}`);
    }

    if (!paymentRows || paymentRows.length === 0) {
      throw new Error('Pagamento não encontrado para o processId informado.');
    }

    const processUpdate = resolveProcessUpdate(actionableStatus);

    if (processUpdate.shouldReleaseProcess) {
      const { error: releaseError } = await supabase
        .from('processes')
        .update({
          payment_status: processUpdate.paymentStatus,
          process_status: processUpdate.processStatus,
          updated_at: now,
        })
        .eq('id', processId);

      if (releaseError) {
        throw new Error(`Erro ao liberar processo: ${releaseError.message}`);
      }
    } else {
      const { error: statusError } = await supabase
        .from('processes')
        .update({
          payment_status: processUpdate.paymentStatus,
          updated_at: now,
        })
        .eq('id', processId);

      if (statusError) {
        throw new Error(`Erro ao atualizar status do processo: ${statusError.message}`);
      }
    }

    const baseMessage = `Webhook Stripe processado (${event.type}). payment_status=${actionableStatus}.`;
    const detailMessage = `event_id=${event.id}; checkout_session_id=${checkoutSessionId ?? '-'}; payment_intent_id=${paymentIntentId ?? '-'}.`;

    const { error: eventsError } = await supabase
      .from('process_events')
      .insert([
        {
          org_id: process.org_id,
          process_id: processId,
          tipo: 'status_change',
          mensagem: `Webhook recebido (${event.type}). stripeEventId=${event.id}.`,
          correlation_process_id: processId,
          correlation_checkout_session_id: checkoutSessionId,
          correlation_stripe_event_id: event.id,
          event_code: 'webhook_received',
        },
        {
          org_id: process.org_id,
          process_id: processId,
          tipo: 'status_change',
          mensagem: `Webhook validado (${event.type}). stripeEventId=${event.id}.`,
          correlation_process_id: processId,
          correlation_checkout_session_id: checkoutSessionId,
          correlation_stripe_event_id: event.id,
          event_code: 'webhook_validated',
        },
        {
          org_id: process.org_id,
          process_id: processId,
          tipo: 'status_change',
          mensagem: `${baseMessage} ${detailMessage}`,
          correlation_process_id: processId,
          correlation_checkout_session_id: checkoutSessionId,
          correlation_stripe_event_id: event.id,
          event_code: mapEventToAuditCode(event.type),
        },
      ]);

    if (eventsError) {
      logAudit('process_events_insert_failed', { processId, error: eventsError.message });
    }

    if (processUpdate.shouldReleaseProcess) {
      const { error: releaseEventError } = await supabase
        .from('process_events')
        .insert({
          org_id: process.org_id,
          process_id: processId,
          tipo: 'status_change',
          mensagem: `Processo liberado após confirmação de pagamento. stripeEventId=${event.id}.`,
          correlation_process_id: processId,
          correlation_checkout_session_id: checkoutSessionId,
          correlation_stripe_event_id: event.id,
          event_code: 'process_released',
        });

      if (releaseEventError) {
        logAudit('release_event_insert_failed', { processId, error: releaseEventError.message });
      }

      // Send certificate email automatically
      try {
        const sendUrl = `${supabaseUrl}/functions/v1/send-certificate`;
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        if (anonKey) {
          const certResponse = await fetch(sendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ processId }),
          });
          const certResult = await certResponse.json();
          if (!certResult.success) {
            logAudit('certificate_send_failed', { processId, error: certResult.error });
          }
        }
      } catch (certErr) {
        logAudit('certificate_send_error', { processId, error: String(certErr) });
      }
    }

    const { data: syncCheck, error: syncError } = await supabase
      .from('processes')
      .select('payment_status, payments!inner(status)')
      .eq('id', processId)
      .single();

    if (syncError) {
      logAudit('sync_check_failed', { processId, error: syncError.message });
    } else if (syncCheck) {
      const processPaymentStatus = syncCheck.payment_status;
      const paymentStatus = (syncCheck as Record<string, unknown>).payments as Record<string, unknown>;
      const actualPaymentStatus = typeof paymentStatus === 'object' && paymentStatus !== null
        ? (paymentStatus as Record<string, unknown>).status
        : null;
      if (actualPaymentStatus && processPaymentStatus !== actualPaymentStatus) {
        logAudit('sync_mismatch', { processId, processPaymentStatus, actualPaymentStatus });
      }
    }

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
    const message = error instanceof Error ? error.message : 'Falha ao processar webhook Stripe.';
    logAudit('webhook_processing_failed', { error: message, eventId: event?.id ?? null });
    return jsonResponse(500, { success: false, error: message });
  }
});
