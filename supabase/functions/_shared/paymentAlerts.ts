/**
 * Alertas de pagamento (MISSÃO 002): e-mail ao responsável financeiro + notificação
 * no painel da organização (tabela org_notifications, migration 064).
 * Falhas aqui NUNCA interrompem o webhook — apenas ficam registadas em log.
 */
import { escapeHtml } from './authz.ts';

export const DEFAULT_PAYMENT_ALERT_EMAIL = 'contato@vainaai.pt';

export type PaymentAlert = {
  kind: 'payment_received' | 'payment_amount_mismatch';
  orgId: string;
  orgName: string;
  processId: string;
  protocolo?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  amountLabel: string;
  expectedLabel?: string | null;
  stripeEventId: string;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
};

export function alertRecipients(): string[] {
  const raw = Deno.env.get('PAYMENT_ALERT_EMAIL') ?? DEFAULT_PAYMENT_ALERT_EMAIL;
  return raw.split(',').map((e) => e.trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

export function alertTitle(a: PaymentAlert): string {
  return a.kind === 'payment_received'
    ? `Pagamento recebido: ${a.amountLabel} — ${a.orgName}`
    : `ALERTA: valor pago diverge do esperado (${a.amountLabel}) — ${a.orgName}`;
}

export async function sendPaymentAlertEmail(a: PaymentAlert): Promise<{ sent: boolean; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY') ?? Deno.env.get('ACCESS_EMAIL_API_KEY') ?? '';
  const from = Deno.env.get('FROM_EMAIL') ?? Deno.env.get('ACCESS_EMAIL_FROM') ?? '';
  const to = alertRecipients();
  if (!apiKey || !from || to.length === 0) {
    return { sent: false, error: 'RESEND_API_KEY/FROM_EMAIL/PAYMENT_ALERT_EMAIL não configurados.' };
  }
  const appUrl = (Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://sgi-fv-prod.vercel.app').replace(/\/$/, '');
  const rows: Array<[string, string]> = [
    ['Organização', a.orgName],
    ['Valor recebido (Stripe)', a.amountLabel],
    ...(a.expectedLabel ? [['Valor esperado', a.expectedLabel] as [string, string]] : []),
    ['Cliente', a.clientName || '-'],
    ['E-mail do cliente', a.clientEmail || '-'],
    ['Protocolo', a.protocolo || '-'],
    ['Processo', a.processId],
    ['Evento Stripe', a.stripeEventId],
    ['Checkout session', a.checkoutSessionId || '-'],
    ['Payment intent', a.paymentIntentId || '-'],
  ];
  const intro = a.kind === 'payment_received'
    ? 'Foi confirmado um pagamento pela Stripe. O valor recebido corresponde ao valor esperado e o processo foi liberado.'
    : 'A Stripe reportou um pagamento cujo valor/moeda NÃO corresponde ao valor calculado pelo servidor. O processo NÃO foi liberado. Verifique no painel Stripe antes de qualquer ação.';
  const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6">
  <h2 style="margin:0 0 8px;color:${a.kind === 'payment_received' ? '#047857' : '#b91c1c'}">${escapeHtml(alertTitle(a))}</h2>
  <p>${escapeHtml(intro)}</p>
  <table cellpadding="6" style="border-collapse:collapse;font-size:14px">
    ${rows.map(([k, v]) => `<tr><td style="border:1px solid #e5e7eb;font-weight:600">${escapeHtml(k)}</td><td style="border:1px solid #e5e7eb">${escapeHtml(v)}</td></tr>`).join('')}
  </table>
  <p style="margin-top:16px">Relatório financeiro: <a href="${escapeHtml(appUrl)}/#/dashboard">${escapeHtml(appUrl)}</a></p>
  <p style="color:#6b7280;font-size:12px">Mensagem automática do SIGA-FV (stripe-webhook). Confirme sempre o crédito no painel Stripe.</p>
</div>`;
  const text = [alertTitle(a), '', intro, '', ...rows.map(([k, v]) => `${k}: ${v}`)].join('\n');
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `SIGA-FV Pagamentos <${from}>`, to, subject: alertTitle(a), html, text }),
    });
    if (!res.ok) return { sent: false, error: `Resend ${res.status}: ${await res.text()}` };
    return { sent: true };
  } catch (err) {
    return { sent: false, error: String(err) };
  }
}

// deno-lint-ignore no-explicit-any
export async function insertOrgNotification(supabase: any, a: PaymentAlert, metadata: Record<string, unknown>): Promise<string | null> {
  const { error } = await supabase.from('org_notifications').insert({
    org_id: a.orgId,
    type: a.kind,
    severity: a.kind === 'payment_received' ? 'success' : 'critical',
    title: alertTitle(a),
    body: a.kind === 'payment_received'
      ? `Pagamento de ${a.amountLabel} confirmado (protocolo ${a.protocolo || '-'}, cliente ${a.clientName || '-'}).`
      : `Valor pago ${a.amountLabel} diverge do esperado ${a.expectedLabel || '-'} (protocolo ${a.protocolo || '-'}). Processo não liberado.`,
    process_id: a.processId,
    metadata,
  });
  return error ? error.message : null;
}
