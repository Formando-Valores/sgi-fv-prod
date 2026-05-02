import { SUPABASE_EDGE_FUNCTIONS } from './supabaseFunctions';

type CreateCheckoutSessionParams = {
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  processId: string;
  clientId: string;
  serviceId: string;
  organizationId: string;
  areaId: string;
  sectorId: string;
};

type CreateCheckoutSessionResponse = {
  sessionId: string;
  url: string;
};

const buildFunctionUrl = (functionName: string) => {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();

  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL não configurada no frontend.');
  }

  return `${supabaseUrl}/functions/v1/${functionName}`;
};

/**
 * Camada segura de consumo do frontend para iniciar checkout no backend.
 * Nenhuma chave secreta do Stripe é usada aqui.
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CreateCheckoutSessionResponse> {
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

  if (!anonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY não configurada no frontend.');
  }

  const response = await fetch(buildFunctionUrl(SUPABASE_EDGE_FUNCTIONS.STRIPE_CREATE_CHECKOUT_SESSION), {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = String(payload?.error ?? 'Não foi possível criar a sessão de checkout.');
    throw new Error(message);
  }

  return {
    sessionId: String(payload?.sessionId ?? ''),
    url: String(payload?.url ?? ''),
  };
}

export async function createCustomerPortalSession(
  _customerId: string
): Promise<{ url: string } | null> {
  console.warn('Stripe customer portal não implementado');
  return null;
}
