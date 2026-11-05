/**
 * Cálculo de preços no SERVIDOR (MISSÃO 002 / R-05).
 *
 * Módulo puro (sem imports Deno/npm) para poder ser usado tanto pelas Edge
 * Functions como pelos testes automáticos (vitest).
 *
 * Regra de negócio: os valores guardados na base de dados (processes.os_value)
 * estão SEMPRE em BRL. A conversão para EUR usa a
 * taxa fixa EUR_RATE (igual a src/lib/servicesCatalog.ts). Outras moedas são
 * cobradas pelo valor nominal (comportamento herdado do frontend).
 */

export const EUR_RATE = 6;

export function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Converte um valor em BRL (unidades principais) para unidades mínimas (centavos) na moeda de cobrança. */
export function amountToMinorUnits(amountBRL: number, currency: string): number {
  const total = toNumber(amountBRL);
  const cur = String(currency || '').toLowerCase();
  if (cur === 'eur') return Math.round((total / EUR_RATE) * 100);
  return Math.round(total * 100);
}

export type ProcessPricingRow = {
  os_value?: unknown;
  amount?: unknown;
};

/**
 * Valor de referência (BRL) a cobrar por um processo, calculado só com dados da base.
 * Ordem: os_value (valor total da OS, já inclui as taxas associativas — ver
 * create-user e ProcessesSection) → amount (valor gravado no processo).
 * Devolve 0 quando não há valor válido (o chamador deve recusar o checkout).
 */
export function computeProcessAmountBRL(row: ProcessPricingRow | null | undefined): number {
  if (!row) return 0;
  const base = toNumber(row.os_value) > 0 ? toNumber(row.os_value) : toNumber(row.amount);
  return base > 0 ? Math.round(base * 100) / 100 : 0;
}

/** Converte unidades mínimas para principais (ex.: 3000 → 30.00). */
export function minorToMajor(amountMinor: number): number {
  return Math.round(toNumber(amountMinor)) / 100;
}

export type AmountCheck = {
  ok: boolean;
  reason?: 'currency_mismatch' | 'amount_mismatch' | 'missing_expected' | 'missing_received';
  expectedMinor: number | null;
  receivedMinor: number | null;
};

/**
 * Confirma se o valor efetivamente pago (Stripe) corresponde ao valor esperado
 * gravado no servidor. Tolerância de 0 unidades mínimas por omissão.
 */
export function checkPaidAmount(params: {
  expectedMinor: number | null | undefined;
  expectedCurrency: string | null | undefined;
  receivedMinor: number | null | undefined;
  receivedCurrency: string | null | undefined;
  toleranceMinor?: number;
}): AmountCheck {
  const expected = params.expectedMinor == null ? null : Math.round(toNumber(params.expectedMinor));
  const received = params.receivedMinor == null ? null : Math.round(toNumber(params.receivedMinor));
  const tolerance = Math.max(0, Math.round(params.toleranceMinor ?? 0));

  if (expected == null || expected <= 0) {
    return { ok: false, reason: 'missing_expected', expectedMinor: expected, receivedMinor: received };
  }
  if (received == null) {
    return { ok: false, reason: 'missing_received', expectedMinor: expected, receivedMinor: received };
  }
  const expCur = String(params.expectedCurrency || '').toLowerCase();
  const recCur = String(params.receivedCurrency || '').toLowerCase();
  if (expCur && recCur && expCur !== recCur) {
    return { ok: false, reason: 'currency_mismatch', expectedMinor: expected, receivedMinor: received };
  }
  if (Math.abs(expected - received) > tolerance) {
    return { ok: false, reason: 'amount_mismatch', expectedMinor: expected, receivedMinor: received };
  }
  return { ok: true, expectedMinor: expected, receivedMinor: received };
}

/** Formata um valor (unidades principais) para e-mails/alertas, ex.: "30,00 EUR". */
export function formatMoney(amountMajor: number, currency: string): string {
  const n = toNumber(amountMajor);
  return `${n.toFixed(2).replace('.', ',')} ${String(currency || '').toUpperCase()}`;
}

/** Domínio atual da aplicação (fallback quando APP_URL não está definido). */
export const DEFAULT_APP_ORIGIN = 'https://sgi-fv-prod-one.vercel.app';

/**
 * Origens sempre aceites como retorno do checkout: domínio novo, domínio antigo
 * (links já enviados) e o site da Associação (vainaai.pt, com e sem www).
 */
export const DEFAULT_ALLOWED_CHECKOUT_ORIGINS = [
  DEFAULT_APP_ORIGIN,
  'https://sgi-fv-prod.vercel.app',
  'https://www.vainaai.pt',
  'https://vainaai.pt',
];

/**
 * Aceita successUrl/cancelUrl apenas de origens confiáveis (evita redirecionamento
 * aberto a partir de uma página de pagamento legítima). Caso contrário devolve o fallback.
 */
export function safeRedirectUrl(candidate: string, allowedOrigins: string[], fallback: string): string {
  try {
    const url = new URL(String(candidate || ''));
    const ok = allowedOrigins
      .map((o) => { try { return new URL(o).origin; } catch { return ''; } })
      .filter(Boolean)
      .includes(url.origin);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    return ok || local ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}
