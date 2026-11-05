import { describe, expect, it } from 'vitest';
import {
  AI_ORG_ID,
  AI_SENDER_NAME,
  buildMemberTutorialEmail,
  buildMemberWelcomeEmail,
  DEFAULT_APP_URL,
  formatFrom,
  getAppUrl,
  getLoginUrl,
  isMemberProfile,
  senderNameForOrg,
  signupOriginFromSource,
} from '../../supabase/functions/_shared/memberEmails';

const base = { fullName: 'Maria Silva', email: 'maria@exemplo.pt', loginUrl: 'https://sgi-fv-prod-one.vercel.app/#/login' };

describe('E-mail 1 (dados de acesso) — texto aprovado, secção 3', () => {
  it('usa o assunto aprovado e os dados do associado', () => {
    const mail = buildMemberWelcomeEmail({ ...base, paymentUrl: 'https://checkout.stripe.com/c/abc', origin: 'site', passwordDefinedByUser: true, hasAttachment: true });
    expect(mail.subject).toBe('Bem-vindo(a) à Associação contra as Injustiças – os seus dados de acesso ao SIGA-FV');
    expect(mail.text).toContain('Olá, Maria Silva,');
    expect(mail.text).toContain('Recebemos a sua proposta de filiação enviada pelo site vainaai.pt.');
    expect(mail.text).toContain('🔐 Login: maria@exemplo.pt');
    expect(mail.text).toContain('🔑 Senha: a que definiu no formulário');
    expect(mail.text).toContain('👉 Entrar: https://sgi-fv-prod-one.vercel.app/#/login');
    expect(mail.text).toContain('Taxa contributiva associativa anual de 30 €');
    expect(mail.text).toContain('💳 Pagar agora: https://checkout.stripe.com/c/abc');
    expect(mail.text).toContain('Processos → Filiação → Pagar agora');
    expect(mail.text).toContain('Associado efetivo');
    expect(mail.text).toContain('Termo de Adesão');
    expect(mail.text).toContain('+351 916 068 515');
    expect(mail.text).toContain('contato@vainaai.pt');
    expect(mail.text).toContain('Av. Dom Dinis, n.º 68 A – C.C. Oceano – Sala 28 – Odivelas – 2675-328 · NIPC 519206550');
    expect(mail.text).not.toContain('518920747');
    expect(mail.text).not.toMatch(/USUÁRIO OPERADOR|Gerenciar clientes/);
  });

  it('não repete a senha escolhida pela pessoa e mostra a senha provisória criada pela Direção', () => {
    const own = buildMemberWelcomeEmail({ ...base, passwordDefinedByUser: true, temporaryPassword: 'Segredo#1' });
    expect(own.text).not.toContain('Segredo#1');
    const admin = buildMemberWelcomeEmail({ ...base, origin: 'admin', passwordDefinedByUser: false, temporaryPassword: 'Prov1sor!a' });
    expect(admin.text).toContain('🔑 Senha provisória: Prov1sor!a');
  });

  it('sem link de pagamento indica onde pagar dentro do sistema; sem anexo não menciona o PDF', () => {
    const mail = buildMemberWelcomeEmail({ ...base, passwordDefinedByUser: true });
    expect(mail.text).not.toContain('💳');
    expect(mail.text).toContain('Pode pagar dentro do sistema, em Processos → Filiação → Pagar agora.');
    expect(mail.text).not.toContain('Termo de Adesão');
  });

  it('gera HTML com negrito, ligações e conteúdo escapado', () => {
    const mail = buildMemberWelcomeEmail({ ...base, fullName: '<script>x</script>', passwordDefinedByUser: true });
    expect(mail.html).toContain('<strong>SIGA-FV</strong>');
    expect(mail.html).toContain('<a href="https://sgi-fv-prod-one.vercel.app/#/login"');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });
});

describe('E-mail 2 (guia rápido) — texto aprovado, secção 4', () => {
  it('tem o assunto, o sumário e os nomes reais dos botões', () => {
    const mail = buildMemberTutorialEmail({ fullName: 'Maria Silva', loginUrl: base.loginUrl });
    expect(mail.subject).toBe('Guia rápido do SIGA-FV – como concluir a sua filiação na AI');
    expect(mail.text).toContain('SUMÁRIO');
    expect(mail.text).toContain('1. Entrar no sistema');
    expect(mail.text).toContain('7. Acompanhar processos, enviar documentos e pedir ajuda');
    expect(mail.text).toContain(`Abra ${base.loginUrl}, escreva o seu e-mail e a sua senha e clique em Entrar.`);
    expect(mail.text).toContain('Esqueci minha senha');
    expect(mail.text).toContain('Atualizar senha');
    expect(mail.text).toContain('"Filiação - Maria Silva"');
    expect(mail.text).toContain('Aguardando pagamento');
    expect(mail.text).toContain('clique em Pagar agora');
    expect(mail.text).toContain('30,00 €');
    expect(mail.text).toContain('A Direção da AI');
    expect(mail.text).not.toMatch(/Alterar senha|Os meus processos/);
    expect(mail.html).toContain('<ul');
  });
});

describe('Configuração de envio', () => {
  it('APP_URL com fallback para o domínio novo', () => {
    expect(getAppUrl(() => undefined)).toBe(DEFAULT_APP_URL);
    expect(DEFAULT_APP_URL).toBe('https://sgi-fv-prod-one.vercel.app');
    expect(getAppUrl((k) => (k === 'APP_URL' ? 'https://app.exemplo.pt/' : undefined))).toBe('https://app.exemplo.pt');
    expect(getLoginUrl(() => undefined)).toBe('https://sgi-fv-prod-one.vercel.app/#/login');
  });

  it('distingue associado/cliente de colaborador', () => {
    expect(isMemberProfile('CLIENTE')).toBe(true);
    expect(isMemberProfile('Associado')).toBe(true);
    expect(isMemberProfile('USUÁRIO OPERADOR')).toBe(false);
    expect(isMemberProfile('ADMINISTRADOR')).toBe(false);
    expect(isMemberProfile(undefined)).toBe(false);
  });

  it('remetente da organização AI', () => {
    expect(senderNameForOrg(AI_ORG_ID)).toBe('Associação contra as Injustiças – AI');
    expect(senderNameForOrg('f1d977d1-a4c8-44b9-951b-064b9e632ef9')).toBe('Formando Valores');
    expect(formatFrom(AI_SENDER_NAME, 'no-reply@exemplo.pt')).toBe('"Associação contra as Injustiças – AI" <no-reply@exemplo.pt>');
  });

  it('origem do registo', () => {
    expect(signupOriginFromSource('associate-page')).toBe('site');
    expect(signupOriginFromSource('vainaai')).toBe('site');
    expect(signupOriginFromSource('registro_direto')).toBe('self');
    expect(signupOriginFromSource('cadastro_admin')).toBe('admin');
  });
});
