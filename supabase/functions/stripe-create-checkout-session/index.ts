import Stripe from 'https://esm.sh/stripe@18.3.0?target=deno';

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

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

  if (!stripeSecretKey) {
    return jsonResponse(500, { success: false, error: 'STRIPE_SECRET_KEY não configurada.' });
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

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
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
        processId: String(payload.processId ?? ''),
        clientId: String(payload.clientId ?? ''),
        serviceId: String(payload.serviceId ?? ''),
        organizationId: String(payload.organizationId ?? ''),
        areaId: String(payload.areaId ?? ''),
        sectorId: String(payload.sectorId ?? ''),
      },
    });

    return jsonResponse(200, {
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao criar sessão de checkout.';
    return jsonResponse(500, { success: false, error: message });
  }
});
