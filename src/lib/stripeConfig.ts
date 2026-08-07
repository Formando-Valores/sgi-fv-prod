import { supabase } from '../../supabase';
import { SUPABASE_EDGE_FUNCTIONS } from './supabaseFunctions';

export interface StripeConfigData {
  org_id: string;
  stripe_secret_key: string;
  stripe_secret_key_masked: string;
  stripe_webhook_secret: string;
  stripe_webhook_secret_masked: string;
  stripe_api_version: string;
  default_currency: string;
  allowed_currencies: string[];
  checkout_product_name: string;
  is_live_mode: boolean;
  created_at: string;
  updated_at: string;
}

export interface StripeConfigUpdate {
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  stripe_api_version?: string;
  default_currency?: string;
  allowed_currencies?: string[];
  checkout_product_name?: string;
  is_live_mode?: boolean;
}

function buildFunctionUrl(functionName: string, params?: Record<string, string>): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = new URL(`/functions/v1/${functionName}`, baseUrl);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return url.toString();
}

export async function getStripeConfig(orgId: string): Promise<{ data: StripeConfigData | null; error?: string }> {
  const url = buildFunctionUrl(SUPABASE_EDGE_FUNCTIONS.STRIPE_CONFIG, { org_id: orgId });

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    });

    const text = await response.text();
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(text);
    } catch {
      return { data: null, error: `Resposta inválida do servidor (HTTP ${response.status}). Verifique se a edge function stripe-config está deployada.` };
    }

    if (!response.ok || !result.success) {
      return { data: null, error: String(result.error || 'Erro ao buscar configuração Stripe.') };
    }

    return { data: result.data as StripeConfigData };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: `Erro de conexão: ${message}. Verifique se a edge function stripe-config está deployada.` };
  }
}

export async function updateStripeConfig(
  orgId: string,
  config: StripeConfigUpdate,
): Promise<{ data: Partial<StripeConfigData> | null; error?: string }> {
  const url = buildFunctionUrl(SUPABASE_EDGE_FUNCTIONS.STRIPE_CONFIG, { org_id: orgId });

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(config),
    });

    const text = await response.text();
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(text);
    } catch {
      return { data: null, error: `Resposta inválida do servidor (HTTP ${response.status}). Verifique se a edge function stripe-config está deployada.` };
    }

    if (!response.ok || !result.success) {
      return { data: null, error: String(result.error || 'Erro ao atualizar configuração Stripe.') };
    }

    return { data: result.data as Partial<StripeConfigData> };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: `Erro de conexão: ${message}. Verifique se a edge function stripe-config está deployada.` };
  }
}
