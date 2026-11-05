/**
 * Relatório semanal por organização (Edge Function weekly-org-report).
 * Módulo puro (sem imports Deno/npm) para poder ser testado com vitest.
 */
import { AI_ORG_ID, escapeHtmlText } from './memberEmails.ts';

export const FV_REPORT_EMAIL = 'contato@formandovalores.com';
export const AI_REPORT_EMAIL = 'contato@vainaai.pt';
export const REPORT_PERIOD_DAYS = 7;

export type ReportOrg = { id: string; name?: string | null; slug?: string | null; report_email?: string | null };
export type OrgAdminContact = { role: string; email?: string | null };

export type ReportEvent = {
  event_type: 'new_member' | 'payment_paid' | string;
  occurred_at: string;
  person_name?: string | null;
  person_email?: string | null;
  member_role?: string | null;
  protocolo?: string | null;
  amount?: number | string | null;
  currency?: string | null;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

export type RecipientResolution = {
  to: string[];
  source: 'override' | 'report_email' | 'known_org' | 'owner_admin' | 'none';
};

/**
 * Destinatário: override de teste → organizations.report_email → valores conhecidos
 * (Formando Valores / AI) → e-mail(s) do owner (ou, na falta, dos admin) da organização.
 */
export function resolveReportRecipients(
  org: ReportOrg,
  admins: OrgAdminContact[],
  override?: string | null,
): RecipientResolution {
  if (isValidEmail(override)) return { to: [override.trim().toLowerCase()], source: 'override' };
  if (isValidEmail(org.report_email)) return { to: [org.report_email.trim().toLowerCase()], source: 'report_email' };
  if (org.slug === 'default') return { to: [FV_REPORT_EMAIL], source: 'known_org' };
  if (org.id === AI_ORG_ID) return { to: [AI_REPORT_EMAIL], source: 'known_org' };

  const pick = (role: string) =>
    Array.from(
      new Set(
        admins
          .filter((a) => a.role === role && isValidEmail(a.email))
          .map((a) => String(a.email).trim().toLowerCase()),
      ),
    );
  const owners = pick('owner');
  if (owners.length) return { to: owners, source: 'owner_admin' };
  const adminEmails = pick('admin');
  if (adminEmails.length) return { to: adminEmails, source: 'owner_admin' };
  return { to: [], source: 'none' };
}

export function reportPeriod(now: Date = new Date(), days = REPORT_PERIOD_DAYS) {
  const until = new Date(now.getTime());
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { since, until };
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  senior: 'Usuário Sénior',
  pleno: 'Usuário Pleno',
  staff: 'Usuário Pleno',
  operador: 'Operador',
  client: 'Cliente / associado',
};

export function roleLabel(role?: string | null): string {
  return ROLE_LABELS[String(role ?? '')] ?? (role ? String(role) : '—');
}

export function formatDateTimePt(iso: string, timeZone = 'Europe/Lisbon'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDatePt(d: Date, timeZone = 'Europe/Lisbon'): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function formatAmount(amount: unknown, currency?: string | null): string {
  const n = Number(amount);
  if (amount === null || amount === undefined || amount === '' || !Number.isFinite(n)) return '—';
  const cur = String(currency || 'EUR').toUpperCase();
  try {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: cur }).format(n);
  } catch {
    return `${n.toFixed(2)} ${cur}`;
  }
}

export type ReportSummary = {
  newMembers: ReportEvent[];
  payments: ReportEvent[];
  totalsByCurrency: Record<string, number>;
};

export function summarizeEvents(events: ReportEvent[]): ReportSummary {
  const sorted = [...events].sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));
  const newMembers = sorted.filter((e) => e.event_type === 'new_member');
  const payments = sorted.filter((e) => e.event_type === 'payment_paid');
  const totalsByCurrency: Record<string, number> = {};
  for (const p of payments) {
    const n = Number(p.amount);
    if (!Number.isFinite(n)) continue;
    const cur = String(p.currency || 'EUR').toUpperCase();
    totalsByCurrency[cur] = Math.round(((totalsByCurrency[cur] ?? 0) + n) * 100) / 100;
  }
  return { newMembers, payments, totalsByCurrency };
}

export type WeeklyReportEmail = { subject: string; html: string; text: string; summary: ReportSummary };

export function buildWeeklyReportEmail(params: {
  orgName: string;
  since: Date;
  until: Date;
  events: ReportEvent[];
  appUrl: string;
}): WeeklyReportEmail {
  const { orgName, since, until, appUrl } = params;
  const summary = summarizeEvents(params.events);
  const periodLabel = `${formatDatePt(since)} a ${formatDatePt(until)}`;
  const subject = `Relatório semanal SIGA-FV – ${orgName} (${periodLabel})`;
  const totals = Object.entries(summary.totalsByCurrency)
    .map(([cur, value]) => formatAmount(value, cur))
    .join(' + ') || formatAmount(0, 'EUR');

  const text: string[] = [
    `Relatório semanal – ${orgName}`,
    `Período: ${periodLabel}`,
    '',
    `Novos utilizadores: ${summary.newMembers.length}`,
    `Novos pagamentos: ${summary.payments.length} (total: ${totals})`,
    '',
  ];
  if (summary.newMembers.length) {
    text.push('NOVOS UTILIZADORES');
    for (const m of summary.newMembers) {
      text.push(`- ${formatDateTimePt(m.occurred_at)} · ${m.person_name ?? '—'} · ${m.person_email ?? '—'} · ${roleLabel(m.member_role)}`);
    }
    text.push('');
  }
  if (summary.payments.length) {
    text.push('NOVOS PAGAMENTOS');
    for (const p of summary.payments) {
      text.push(`- ${formatDateTimePt(p.occurred_at)} · ${p.person_name ?? '—'} · ${p.protocolo ?? '—'} · ${formatAmount(p.amount, p.currency)}`);
    }
    text.push('');
  }
  if (!summary.newMembers.length && !summary.payments.length) {
    text.push('Sem novos utilizadores nem pagamentos nesta semana.', '');
  }
  text.push(`Abrir o painel: ${appUrl}/#/dashboard`, '', 'Mensagem automática do SIGA-FV.');

  const esc = (v: unknown) => escapeHtmlText(String(v ?? '—'));
  const th = 'style="text-align:left;padding:8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;"';
  const td = 'style="padding:8px;border-bottom:1px solid #f1f5f9;font-size:13px;"';
  const membersTable = summary.newMembers.length
    ? `<table style="width:100%;border-collapse:collapse;margin:0 0 20px;"><thead><tr><th ${th}>Data</th><th ${th}>Nome</th><th ${th}>E-mail</th><th ${th}>Papel</th></tr></thead><tbody>${summary.newMembers
        .map((m) => `<tr><td ${td}>${esc(formatDateTimePt(m.occurred_at))}</td><td ${td}>${esc(m.person_name)}</td><td ${td}>${esc(m.person_email)}</td><td ${td}>${esc(roleLabel(m.member_role))}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p style="margin:0 0 20px;color:#64748b;">Sem novos utilizadores nesta semana.</p>';
  const paymentsTable = summary.payments.length
    ? `<table style="width:100%;border-collapse:collapse;margin:0 0 20px;"><thead><tr><th ${th}>Data</th><th ${th}>Cliente</th><th ${th}>Processo</th><th ${th}>Valor</th></tr></thead><tbody>${summary.payments
        .map((p) => `<tr><td ${td}>${esc(formatDateTimePt(p.occurred_at))}</td><td ${td}>${esc(p.person_name)}</td><td ${td}>${esc(p.protocolo)}</td><td ${td}>${esc(formatAmount(p.amount, p.currency))}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p style="margin:0 0 20px;color:#64748b;">Sem novos pagamentos nesta semana.</p>';

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:680px;">
<h2 style="margin:0 0 4px;">Relatório semanal – ${esc(orgName)}</h2>
<p style="margin:0 0 20px;color:#475569;">Período: ${esc(periodLabel)}</p>
<table style="border-collapse:collapse;margin:0 0 24px;"><tr>
<td style="padding:12px 18px;background:#eff6ff;border-radius:10px;"><div style="font-size:12px;color:#1d4ed8;">Novos utilizadores</div><div style="font-size:24px;font-weight:700;">${summary.newMembers.length}</div></td>
<td style="width:12px;"></td>
<td style="padding:12px 18px;background:#ecfdf5;border-radius:10px;"><div style="font-size:12px;color:#047857;">Novos pagamentos</div><div style="font-size:24px;font-weight:700;">${summary.payments.length}</div><div style="font-size:12px;color:#047857;">Total: ${esc(totals)}</div></td>
</tr></table>
<h3 style="margin:0 0 8px;">Novos utilizadores</h3>
${membersTable}
<h3 style="margin:0 0 8px;">Novos pagamentos</h3>
${paymentsTable}
<p style="margin:16px 0;"><a href="${esc(appUrl)}/#/dashboard" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;">Abrir o painel</a></p>
<p style="font-size:12px;color:#94a3b8;">Mensagem automática do SIGA-FV.</p>
</div>`;

  return { subject, html, text: text.join('\n'), summary };
}

/**
 * Quem pode disparar o relatório: o agendamento (cabeçalho x-cron-secret igual a
 * CRON_SECRET), chamadas servidor→servidor com a service role, ou o administrador
 * global (para testes a partir de uma sessão autenticada).
 */
export function decideWeeklyReportAccess(input: {
  cronSecretMatches: boolean;
  callerKind: 'service' | 'user' | 'anonymous';
  isGlobalAdmin?: boolean;
}): { allowed: boolean; status: number; via?: 'cron' | 'service' | 'global_admin' } {
  if (input.cronSecretMatches) return { allowed: true, status: 200, via: 'cron' };
  if (input.callerKind === 'service') return { allowed: true, status: 200, via: 'service' };
  if (input.callerKind === 'user' && input.isGlobalAdmin) return { allowed: true, status: 200, via: 'global_admin' };
  return { allowed: false, status: input.callerKind === 'anonymous' ? 401 : 403 };
}
