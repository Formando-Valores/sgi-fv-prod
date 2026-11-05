import { describe, expect, it } from 'vitest';
import { canSeeActivityBell, countUnseen, describeActivityEvent, formatBadgeCount } from '../../src/lib/notificationsAccess';
import { buildWhatsAppUrl, buildWhatsAppWelcomeMessage, getFrontendLoginUrl, normalizeWhatsAppPhone } from '../../src/lib/memberWhatsApp';

describe('Sino · papéis com acesso', () => {
  it('owner, admin, sénior e pleno (staff) veem o sino', () => {
    for (const r of ['owner', 'admin', 'senior', 'sénior', 'pleno', 'staff', 'ADMIN']) expect(canSeeActivityBell(r)).toBe(true);
  });
  it('operador, cliente e sem papel não veem', () => {
    for (const r of ['operador', 'client', 'cliente', '', null, undefined]) expect(canSeeActivityBell(r)).toBe(false);
  });
});

describe('Sino · contador e textos', () => {
  it('conta só os não vistos e limita o badge a 9+', () => {
    expect(countUnseen([{ is_unseen: true }, { is_unseen: false }, { is_unseen: true }])).toBe(2);
    expect(formatBadgeCount(0)).toBe('');
    expect(formatBadgeCount(3)).toBe('3');
    expect(formatBadgeCount(12)).toBe('9+');
  });
  it('descreve novos utilizadores e pagamentos', () => {
    const base = { event_id: 'x', occurred_at: '2026-11-05T10:00:00Z', title: '', process_id: null, is_unseen: true };
    const m = describeActivityEvent({ ...base, event_type: 'new_member', person_name: 'Ana', person_email: 'ana@x.pt', member_role: 'client', protocolo: null, amount: null, currency: null });
    expect(m.title).toBe('Novo utilizador');
    expect(m.description).toBe('Ana · ana@x.pt · Cliente');
    const p = describeActivityEvent({ ...base, event_type: 'payment_paid', person_name: 'Ana', person_email: null, member_role: null, protocolo: 'JURA-1', amount: 30, currency: 'EUR' });
    expect(p.title).toBe('Novo pagamento recebido');
    expect(p.description).toMatch(/^Ana · processo JURA-1 · 30,00\s€$/);
  });
});

describe('WhatsApp manual — texto aprovado, secção 5', () => {
  const message = buildWhatsAppWelcomeMessage({ fullName: 'Maria Silva', email: 'maria@exemplo.pt', loginUrl: getFrontendLoginUrl(undefined) });
  it('usa o texto aprovado com o domínio novo e o nome real do botão', () => {
    expect(message).toContain('Olá Maria Silva! 👋 Bem-vindo(a) à Associação contra as Injustiças – AI.');
    expect(message).toContain('🔐 Login: maria@exemplo.pt');
    expect(message).toContain('👉 https://sgi-fv-prod-one.vercel.app/#/login');
    expect(message).toContain('4️⃣ Clique em PAGAR AGORA → 30,00 € (pagamento seguro Stripe)');
    expect(message).toContain('💳 Pagar já: no sistema, em Processos → Filiação → Pagar agora');
    expect(message).toContain('❓ Dúvidas: responda a esta mensagem.');
  });
  it('link wa.me com e sem número', () => {
    expect(buildWhatsAppUrl('Olá', '+351 916 068 515')).toBe('https://wa.me/351916068515?text=Ol%C3%A1');
    expect(buildWhatsAppUrl('Olá', '916068515')).toBe('https://wa.me/351916068515?text=Ol%C3%A1');
    expect(buildWhatsAppUrl('Olá', null)).toBe('https://wa.me/?text=Ol%C3%A1');
    expect(normalizeWhatsAppPhone('0055 11 91234-5678')).toBe('5511912345678');
    expect(normalizeWhatsAppPhone('---')).toBe('');
    expect(normalizeWhatsAppPhone('123')).toBe('');
  });
  it('VITE_APP_URL substitui o domínio quando definido', () => {
    expect(getFrontendLoginUrl('https://app.exemplo.pt/')).toBe('https://app.exemplo.pt/#/login');
  });
});
