import { EUR_RATE } from './servicesCatalog';

export const CURRENCY_OPTIONS = [
  { code: 'brl', label: 'BRL (Real Brasileiro)', symbol: 'R$' },
  { code: 'eur', label: 'EUR (Euro)', symbol: '€' },
  { code: 'usd', label: 'USD (Dólar Americano)', symbol: 'US$' },
] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['code'];

export function currencySymbol(code: string): string {
  return CURRENCY_OPTIONS.find((c) => c.code === code)?.symbol ?? code.toUpperCase();
}

/**
 * Converte um valor armazenado em BRL (base de dados) para centavos na moeda de cobrança.
 * Valores no banco são sempre BRL (taxa EUR_RATE para euro).
 */
export function amountToMinorUnits(amountBRL: number, currency: string): number {
  const total = Number(amountBRL) || 0;
  if (currency === 'brl') return Math.round(total * 100);
  if (currency === 'eur') return Math.round((total / EUR_RATE) * 100);
  return Math.round(total * 100);
}

/**
 * Busca as moedas permitidas de uma organização na config Stripe.
 * Usa a edge function pública (sem JWT) para não expor chaves.
 */
export async function getOrgCurrencies(orgId: string): Promise<{
  defaultCurrency: string;
  allowedCurrencies: string[];
}> {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase não configurado no frontend.');
  }

  const url = new URL(`/functions/v1/stripe-org-currencies`, supabaseUrl);
  url.searchParams.set('org_id', orgId);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.success) {
    throw new Error(String(payload?.error ?? 'Não foi possível buscar as moedas da organização.'));
  }

  const allowed = Array.isArray(payload?.data?.allowed_currencies) ? payload.data.allowed_currencies : [];
  return {
    defaultCurrency: String(payload?.data?.default_currency ?? 'eur'),
    allowedCurrencies: allowed.length > 0 ? allowed : ['eur'],
  };
}
