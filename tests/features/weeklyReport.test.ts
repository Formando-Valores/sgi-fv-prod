import { describe, expect, it } from 'vitest';
import {
  buildWeeklyReportEmail,
  decideWeeklyReportAccess,
  reportPeriod,
  resolveReportRecipients,
  summarizeEvents,
} from '../../supabase/functions/_shared/weeklyReport';

const FV = { id: 'f1d977d1-a4c8-44b9-951b-064b9e632ef9', name: 'Formando Valores - FV', slug: 'default', report_email: null };
const AI = { id: 'd535afe4-6279-40a9-aaa9-f5a7f6ee4825', name: 'Associação contra as Injustiças - AI', slug: 'associacao-contra-as-injusticas-ai-1772497012397', report_email: null };
const OTHER = { id: '11111111-1111-1111-1111-111111111111', name: 'Outra', slug: 'outra', report_email: null };

describe('Relatório semanal · destinatários', () => {
  it('usa report_email quando preenchido', () => {
    expect(resolveReportRecipients({ ...OTHER, report_email: 'Relatorios@Outra.pt' }, [])).toEqual({ to: ['relatorios@outra.pt'], source: 'report_email' });
  });
  it('Formando Valores e AI têm destinatários fixos', () => {
    expect(resolveReportRecipients(FV, []).to).toEqual(['contato@formandovalores.com']);
    expect(resolveReportRecipients(AI, []).to).toEqual(['contato@vainaai.pt']);
  });
  it('restantes: owner primeiro, depois admin; sem contactos não envia', () => {
    const admins = [
      { role: 'admin', email: 'admin@outra.pt' },
      { role: 'owner', email: 'dono@outra.pt' },
      { role: 'owner', email: 'dono@outra.pt' },
    ];
    expect(resolveReportRecipients(OTHER, admins)).toEqual({ to: ['dono@outra.pt'], source: 'owner_admin' });
    expect(resolveReportRecipients(OTHER, [{ role: 'admin', email: 'admin@outra.pt' }, { role: 'admin', email: 'inválido' }]).to).toEqual(['admin@outra.pt']);
    expect(resolveReportRecipients(OTHER, [])).toEqual({ to: [], source: 'none' });
  });
  it('override de teste tem prioridade; override inválido é ignorado', () => {
    expect(resolveReportRecipients(AI, [], 'teste@exemplo.pt')).toEqual({ to: ['teste@exemplo.pt'], source: 'override' });
    expect(resolveReportRecipients(AI, [], 'nao-e-email').source).toBe('known_org');
  });
});

describe('Relatório semanal · conteúdo', () => {
  const events = [
    { event_type: 'new_member', occurred_at: '2026-11-02T10:00:00Z', person_name: 'Ana', person_email: 'ana@x.pt', member_role: 'client' },
    { event_type: 'payment_paid', occurred_at: '2026-11-03T10:00:00Z', person_name: 'Ana', protocolo: 'JURA-1', amount: 30, currency: 'eur' },
    { event_type: 'payment_paid', occurred_at: '2026-11-04T10:00:00Z', person_name: 'Rui', protocolo: 'JURA-2', amount: '30.00', currency: 'EUR' },
  ];
  it('resume utilizadores, pagamentos e totais', () => {
    const s = summarizeEvents(events);
    expect(s.newMembers).toHaveLength(1);
    expect(s.payments).toHaveLength(2);
    expect(s.totalsByCurrency).toEqual({ EUR: 60 });
  });
  it('gera e-mail em português com tabelas e sem HTML injetado', () => {
    const { since, until } = reportPeriod(new Date('2026-11-09T07:00:00Z'));
    const mail = buildWeeklyReportEmail({ orgName: 'Org <b>', since, until, events, appUrl: 'https://sgi-fv-prod-one.vercel.app' });
    expect(mail.subject).toBe('Relatório semanal SIGA-FV – Org <b> (02/11/2026 a 09/11/2026)');
    expect(mail.html).toContain('Novos utilizadores');
    expect(mail.html).toContain('Novos pagamentos');
    expect(mail.html).toContain('Org &lt;b&gt;');
    expect(mail.html).toContain('Cliente / associado');
    expect(mail.text).toContain('Novos pagamentos: 2');
    expect(mail.text).toMatch(/total: 60,00\s€/);
  });
  it('semana sem movimentos', () => {
    const { since, until } = reportPeriod(new Date('2026-11-09T07:00:00Z'));
    const mail = buildWeeklyReportEmail({ orgName: 'X', since, until, events: [], appUrl: 'https://a.pt' });
    expect(mail.text).toContain('Sem novos utilizadores nem pagamentos nesta semana.');
  });
});

describe('Relatório semanal · autorização', () => {
  it('aceita cron com segredo, service role e admin global', () => {
    expect(decideWeeklyReportAccess({ cronSecretMatches: true, callerKind: 'anonymous' }).allowed).toBe(true);
    expect(decideWeeklyReportAccess({ cronSecretMatches: false, callerKind: 'service' }).allowed).toBe(true);
    expect(decideWeeklyReportAccess({ cronSecretMatches: false, callerKind: 'user', isGlobalAdmin: true }).allowed).toBe(true);
  });
  it('recusa anónimos e utilizadores comuns', () => {
    expect(decideWeeklyReportAccess({ cronSecretMatches: false, callerKind: 'anonymous' })).toEqual({ allowed: false, status: 401 });
    expect(decideWeeklyReportAccess({ cronSecretMatches: false, callerKind: 'user', isGlobalAdmin: false })).toEqual({ allowed: false, status: 403 });
  });
});
