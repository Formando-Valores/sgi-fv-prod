/**
 * weekly-org-report — relatório semanal por organização (novos utilizadores e
 * pagamentos dos últimos 7 dias), enviado por e-mail via Resend.
 *
 * Autorização (verify_jwt = false; a verificação é feita aqui):
 *   - agendamento pg_cron: cabeçalho `x-cron-secret` igual ao secret CRON_SECRET;
 *   - service role (Authorization: Bearer <service role key>);
 *   - administrador global autenticado (testes).
 *
 * Corpo JSON opcional (testes):
 *   { "org_id": "<uuid>", "recipient": "teste@exemplo.pt", "dry_run": true, "days": 7 }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveCaller } from '../_shared/auth.ts';
import { timingSafeEqual } from '../_shared/authz.ts';
import { getResendConfig, sendResendEmail } from '../_shared/memberEmailSender.ts';
import { DEFAULT_SENDER_NAME, getAppUrl, senderNameForOrg } from '../_shared/memberEmails.ts';
import {
  buildWeeklyReportEmail,
  decideWeeklyReportAccess,
  isValidEmail,
  REPORT_PERIOD_DAYS,
  reportPeriod,
  resolveReportRecipients,
  type OrgAdminContact,
  type ReportEvent,
  type ReportOrg,
} from '../_shared/weeklyReport.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { success: false, error: 'Método não permitido.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { success: false, error: 'Configuração do Supabase ausente.' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Preferir secret configurado no runtime; fallback para o Vault, acessível apenas
  // através de RPC reservado à service_role (o cron não depende de secret manual no Edge).
  let vaultCronSecret = '';
  try {
    const { data, error } = await admin.rpc('get_weekly_report_cron_secret');
    if (!error && typeof data === 'string') vaultCronSecret = data;
    else if (error) console.warn('[weekly-org-report] não foi possível ler secret do Vault', error.message);
  } catch (error) {
    console.warn('[weekly-org-report] falha ao ler secret do Vault', error);
  }
  const cronSecret = Deno.env.get('CRON_SECRET')?.trim() || vaultCronSecret;
  const headerSecret = request.headers.get('x-cron-secret') ?? '';
  const cronSecretMatches = cronSecret.length >= 16 && headerSecret.length > 0 && timingSafeEqual(headerSecret, cronSecret);
  const caller = cronSecretMatches ? null : await resolveCaller(request);
  const access = decideWeeklyReportAccess({
    cronSecretMatches,
    callerKind: caller?.kind ?? 'service',
    isGlobalAdmin: caller?.kind === 'user' ? caller.isGlobalAdmin === true : false,
  });
  if (!access.allowed) {
    return jsonResponse(access.status, { success: false, error: 'Não autorizado.' });
  }

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const orgIdFilter = String(body?.org_id ?? '').trim();
  const recipientOverride = String(body?.recipient ?? '').trim();
  const dryRun = body?.dry_run === true || body?.dry_run === 'true';
  const days = Math.min(Math.max(Number(body?.days) || REPORT_PERIOD_DAYS, 1), 31);

  if (orgIdFilter && !UUID_RE.test(orgIdFilter)) {
    return jsonResponse(400, { success: false, error: 'org_id inválido.' });
  }
  if (recipientOverride && !isValidEmail(recipientOverride)) {
    return jsonResponse(400, { success: false, error: 'recipient inválido.' });
  }
  // Destinatário arbitrário só é permitido em teste seco, limitado a uma organização.
  if (recipientOverride && (!dryRun || !orgIdFilter)) {
    return jsonResponse(400, { success: false, error: 'recipient personalizado só é permitido em dry_run para uma organização específica.' });
  }

  let orgQuery = admin.from('organizations').select('id, name, slug, report_email').order('name');
  if (orgIdFilter) orgQuery = orgQuery.eq('id', orgIdFilter);
  const { data: orgs, error: orgError } = await orgQuery;
  if (orgError) {
    return jsonResponse(500, { success: false, error: `Erro ao ler organizações: ${orgError.message}` });
  }
  if (!orgs?.length) {
    return jsonResponse(404, { success: false, error: 'Nenhuma organização encontrada.' });
  }

  const resend = getResendConfig();
  if (!dryRun && !resend) {
    return jsonResponse(500, { success: false, error: 'Serviço de e-mail não configurado. Defina RESEND_API_KEY e FROM_EMAIL.' });
  }

  const { since, until } = reportPeriod(new Date(), days);
  const appUrl = getAppUrl();
  const results: Record<string, unknown>[] = [];

  for (const org of orgs as ReportOrg[]) {
    const orgName = String(org.name ?? 'Organização');
    try {
      const { data: events, error: eventsError } = await admin.rpc('org_activity_events', {
        p_org_id: org.id,
        p_since: since.toISOString(),
        p_until: until.toISOString(),
      });
      if (eventsError) throw new Error(`eventos: ${eventsError.message}`);

      const { data: members, error: membersError } = await admin
        .from('org_members')
        .select('role, user_id')
        .eq('org_id', org.id)
        .in('role', ['owner', 'admin']);
      if (membersError) throw new Error(`administradores: ${membersError.message}`);

      const adminIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
      const emailById = new Map<string, string | null>();
      if (adminIds.length) {
        const { data: profileRows } = await admin.from('profiles').select('id, email').in('id', adminIds);
        for (const row of (profileRows ?? []) as Array<{ id: string; email: string | null }>) emailById.set(row.id, row.email);
      }
      const admins: OrgAdminContact[] = (members ?? []).map((m: { role: string; user_id: string }) => ({
        role: String(m.role),
        email: emailById.get(m.user_id) ?? null,
      }));

      const recipients = resolveReportRecipients(org, admins, recipientOverride || null);
      const email = buildWeeklyReportEmail({ orgName, since, until, events: (events ?? []) as ReportEvent[], appUrl });
      const base = {
        org_id: org.id,
        org_name: orgName,
        recipients: recipients.to,
        recipient_source: recipients.source,
        new_members: email.summary.newMembers.length,
        payments: email.summary.payments.length,
        totals: email.summary.totalsByCurrency,
      };

      if (!recipients.to.length) {
        results.push({ ...base, sent: false, skipped: 'sem destinatário (report_email/owner/admin)' });
        continue;
      }
      if (dryRun) {
        results.push({ ...base, sent: false, dry_run: true, subject: email.subject, html: orgIdFilter ? email.html : undefined });
        continue;
      }

      const senderName = org.slug === 'default' ? DEFAULT_SENDER_NAME : senderNameForOrg(org.id);
      const sent = await sendResendEmail(resend!, {
        to: recipients.to,
        senderName: `${senderName} – SIGA-FV`,
        content: { subject: email.subject, html: email.html, text: email.text },
      });
      results.push({ ...base, sent: sent.ok, ...(sent.ok ? { resend_id: sent.id ?? null } : { error: sent.error }) });
    } catch (error) {
      results.push({ org_id: org.id, org_name: orgName, sent: false, error: error instanceof Error ? error.message : 'erro desconhecido' });
    }
  }

  console.info('[weekly-org-report] concluído', {
    via: access.via,
    dryRun,
    orgs: results.length,
    sent: results.filter((r) => r.sent === true).length,
  });

  return jsonResponse(200, {
    success: true,
    dry_run: dryRun,
    period: { since: since.toISOString(), until: until.toISOString(), days },
    results,
  });
});
