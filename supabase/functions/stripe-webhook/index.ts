import Stripe from 'https://esm.sh/stripe@18.3.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getOrgStripeConfig } from '../_shared/payments/getOrgStripeConfig.ts';
import { checkPaidAmount, formatMoney, minorToMajor } from '../_shared/pricing.ts';
import { insertOrgNotification, sendPaymentAlertEmail, type PaymentAlert } from '../_shared/paymentAlerts.ts';

type ProcessRecord = {
  id: string;
  org_id: string;
  cliente_user_id?: string | null;
  cliente_nome?: string | null;
  cliente_email?: string | null;
  protocolo?: string | null;
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
    // O pagador é o cliente do processo (antes comparava com responsavel_user_id, que é o staff)
    const processClientId = process.cliente_user_id ?? null;
    if (processClientId && processClientId !== metadata.clientId) {
      // Sessões antigas usavam o id de quem iniciou o checkout (ex.: admin). Não bloqueia:
      // a proteção efetiva é a conferência do valor pago (checkPaidAmount).
      console.warn('[stripe-webhook] clientId do metadata difere do cliente do processo', metadata.processId);
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { success: false, error: 'SUPABASE_URL ou SERVICE_ROLE_KEY não configurados.' });
  }

  // Resolve orgId from the URL path: /functions/v1/stripe-webhook/<org_id>
  const url = new URL(request.url);
  const orgIdFromPath = url.pathname.split('/').filter(Boolean).pop() ?? '';

  // Fetch org-specific Stripe credentials (falls back to env vars when no orgId/config)
  const orgConfig = await getOrgStripeConfig(orgIdFromPath, supabaseUrl, serviceRoleKey);
  const stripeSecretKey = orgConfig.stripeSecretKey;
  const stripeWebhookSecret = orgConfig.stripeWebhookSecret;

  if (!stripeSecretKey || !stripeWebhookSecret) {
    return jsonResponse(500, { success: false, error: 'Credenciais Stripe ausentes.' });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return jsonResponse(400, { success: false, error: 'Assinatura Stripe ausente.' });
  }

  const rawBody = await request.text();
  const stripe = new Stripe(stripeSecretKey, { apiVersion: orgConfig.apiVersion as '2025-03-31.basil' });

  logAudit('webhook_org_resolved', {
    orgIdFromPath,
    resolvedStripeKey: stripeSecretKey.slice(0, 7) + '...',
    hasWebhookSecret: Boolean(stripeWebhookSecret),
    eventId: null,
    processId: null,
  });

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
    let receivedMinor: number | null = null;
    let receivedCurrency: string | null = null;
    let sessionPaymentStatus: string | null = null;

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;
      processId = String(session.metadata?.processId ?? '').trim();
      paymentIntentId = normalizeStripeId(session.payment_intent as string | Stripe.PaymentIntent | null);
      checkoutSessionId = session.id;
      stripeCustomerId = typeof session.customer === 'string' ? session.customer : (session.customer as { id?: string } | null)?.id ?? null;
      Object.assign(metadata, session.metadata ?? {});
      receivedMinor = typeof session.amount_total === 'number' ? session.amount_total : null;
      receivedCurrency = session.currency ?? null;
      sessionPaymentStatus = session.payment_status ?? null;
    }

    if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      processId = String(paymentIntent.metadata?.processId ?? '').trim();
      paymentIntentId = paymentIntent.id;
      checkoutSessionId = String(paymentIntent.metadata?.checkoutSessionId ?? '').trim()
        || (paymentIntent.payment_details as Record<string, unknown> | null)?.order_reference as string | null
        || null;
      Object.assign(metadata, paymentIntent.metadata ?? {});
      receivedMinor = typeof paymentIntent.amount_received === 'number' ? paymentIntent.amount_received : null;
      receivedCurrency = paymentIntent.currency ?? null;
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
      .select('id, org_id, cliente_user_id, cliente_nome, cliente_email, protocolo')
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

    const expectedClientId = process.cliente_user_id ?? null;
    const metadataClientId = String(metadata.clientId ?? '').trim();
    const validatedClientId = isUuid(metadataClientId)
      ? metadataClientId
      : isUuid(expectedClientId)
        ? expectedClientId
        : null;

    const now = new Date().toISOString();
    const actorUserId = (isUuid(process.cliente_user_id) ? process.cliente_user_id : validatedClientId) ?? null;

    // Estado atual do pagamento (valor esperado gravado pelo checkout no servidor)
    const { data: currentPayment } = await supabase
      .from('payments')
      .select('id, status, amount, currency, client_id')
      .eq('process_id', processId)
      .maybeSingle();

    let orgName = process.org_id;
    {
      const { data: orgRow } = await supabase.from('organizations').select('name').eq('id', process.org_id).maybeSingle();
      if (orgRow?.name) orgName = orgRow.name;
    }

    if (actionableStatus === 'paid') {
      // checkout.session.completed com pagamento assíncrono ainda não pago → não marcar como pago
      if (event.type === 'checkout.session.completed' && sessionPaymentStatus && sessionPaymentStatus !== 'paid') {
        logAudit('checkout_completed_not_paid_yet', { processId, eventId: event.id, sessionPaymentStatus });
        return jsonResponse(200, { success: true, pending: true, eventId: event.id });
      }

      // Evento duplicado (checkout.session.completed + payment_intent.succeeded): já pago → sem novos efeitos
      if (String(currentPayment?.status ?? '').toLowerCase() === 'paid') {
        logAudit('payment_already_paid', { processId, eventId: event.id, eventType: event.type });
        return jsonResponse(200, { success: true, alreadyPaid: true, eventId: event.id });
      }

      // MISSÃO 002 / R-05: conferir o valor efetivamente pago contra o valor esperado do servidor
      const expectedMinor = currentPayment?.amount != null
        ? Math.round(Number(currentPayment.amount) * 100)
        : (metadata.expectedAmount ? Number(metadata.expectedAmount) : null);
      const expectedCurrency = currentPayment?.currency ?? metadata.expectedCurrency ?? null;
      const check = checkPaidAmount({ expectedMinor, expectedCurrency, receivedMinor, receivedCurrency });

      if (!check.ok) {
        const alert: PaymentAlert = {
          kind: 'payment_amount_mismatch',
          orgId: process.org_id,
          orgName,
          processId,
          protocolo: process.protocolo,
          clientName: process.cliente_nome,
          clientEmail: process.cliente_email,
          amountLabel: formatMoney(minorToMajor(receivedMinor ?? 0), receivedCurrency ?? ''),
          expectedLabel: expectedMinor != null ? formatMoney(minorToMajor(expectedMinor), expectedCurrency ?? '') : null,
          stripeEventId: event.id,
          checkoutSessionId,
          paymentIntentId,
        };
        await supabase.from('payments').update({
          last_event_type: `${event.type}:amount_mismatch`,
          last_event_at: now,
          updated_at: now,
          stripe_checkout_session_id: checkoutSessionId,
          stripe_payment_intent_id: paymentIntentId,
        }).eq('process_id', processId);
        if (actorUserId) {
          const { error: mmErr } = await supabase.from('process_events').insert({
            org_id: process.org_id,
            process_id: processId,
            tipo: 'status_change',
            mensagem: `ALERTA: valor pago (${alert.amountLabel}) diverge do esperado (${alert.expectedLabel ?? '-'}). Motivo: ${check.reason}. Processo NÃO liberado. stripeEventId=${event.id}.`,
            correlation_process_id: processId,
            correlation_checkout_session_id: checkoutSessionId,
            correlation_stripe_event_id: event.id,
            event_code: 'payment_amount_mismatch',
            event_type: 'payment_amount_mismatch',
            actor_user_id: actorUserId,
            metadata: { reason: check.reason, expected_minor: check.expectedMinor, received_minor: check.receivedMinor, expected_currency: expectedCurrency, received_currency: receivedCurrency },
          });
          if (mmErr) logAudit('mismatch_event_insert_failed', { processId, error: mmErr.message });
        }
        const nErr = await insertOrgNotification(supabase, alert, { reason: check.reason, stripe_event_id: event.id });
        if (nErr) logAudit('notification_insert_failed', { processId, error: nErr });
        const mail = await sendPaymentAlertEmail(alert);
        logAudit('payment_amount_mismatch', { processId, eventId: event.id, reason: check.reason, expectedMinor, receivedMinor, emailSent: mail.sent, emailError: mail.error ?? null });
        // 200 para a Stripe não repetir indefinidamente; o caso fica em revisão manual
        return jsonResponse(200, { success: false, flagged: 'amount_mismatch', reason: check.reason, eventId: event.id });
      }
    }

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
          paid_at: now,
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
          event_type: 'payment_webhook_received',
          actor_user_id: actorUserId,
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
          event_type: 'payment_webhook_validated',
          actor_user_id: actorUserId,
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
          // 'payment_received' alimenta o relatório financeiro (src/lib/reports.ts filtra event_type com "payment")
          event_type: actionableStatus === 'paid' ? 'payment_received' : `payment_${actionableStatus}`,
          actor_user_id: actorUserId,
          metadata: {
            amount_minor: receivedMinor,
            amount: receivedMinor != null ? minorToMajor(receivedMinor) : null,
            currency: receivedCurrency ? receivedCurrency.toUpperCase() : null,
            stripe_event_id: event.id,
          },
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
          event_type: 'process_released',
          actor_user_id: actorUserId,
        });

      if (releaseEventError) {
        logAudit('release_event_insert_failed', { processId, error: releaseEventError.message });
      }

      // MISSÃO 002: alerta de pagamento recebido (e-mail + notificação no painel da organização)
      const paidAlert: PaymentAlert = {
        kind: 'payment_received',
        orgId: process.org_id,
        orgName,
        processId,
        protocolo: process.protocolo,
        clientName: process.cliente_nome,
        clientEmail: process.cliente_email,
        amountLabel: formatMoney(minorToMajor(receivedMinor ?? 0), receivedCurrency ?? ''),
        stripeEventId: event.id,
        checkoutSessionId,
        paymentIntentId,
      };
      const notifErr = await insertOrgNotification(supabase, paidAlert, {
        amount_minor: receivedMinor,
        currency: receivedCurrency,
        stripe_event_id: event.id,
      });
      if (notifErr) logAudit('notification_insert_failed', { processId, error: notifErr });
      const alertMail = await sendPaymentAlertEmail(paidAlert);
      logAudit('payment_alert_email', { processId, sent: alertMail.sent, error: alertMail.error ?? null });

      // Send certificate email automatically
      try {
        const sendUrl = `${supabaseUrl}/functions/v1/send-certificate`;
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        if (serviceRoleKey) {
          // MISSÃO 002 / R-04: chamada servidor→servidor autenticada com a service role
          const certResponse = await fetch(sendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: anonKey || serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
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
