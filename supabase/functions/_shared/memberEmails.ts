/**
 * Textos dos e-mails enviados ao associado/cliente (E-mail 1 — dados de acesso;
 * E-mail 2 — guia rápido). Textos aprovados pelo responsável a 05/11/2026
 * (tutorial_associado_siga-fv.md, secções 3 e 4), com os nomes reais dos
 * botões/menus do SIGA-FV.
 *
 * Módulo puro: sem imports Deno/npm, para poder ser testado com vitest.
 */

export const DEFAULT_APP_URL = 'https://sgi-fv-prod-one.vercel.app';
export const AI_ORG_ID = 'd535afe4-6279-40a9-aaa9-f5a7f6ee4825';
export const AI_SENDER_NAME = 'Associação contra as Injustiças – AI';
export const DEFAULT_SENDER_NAME = 'Formando Valores';
export const AI_NIPC = '519206550';
export const AI_WHATSAPP = '+351 916 068 515';
export const AI_EMAIL = 'contato@vainaai.pt';
export const AI_ADDRESS = 'Av. Dom Dinis, n.º 68 A – C.C. Oceano – Sala 28 – Odivelas – 2675-328';

/** Caminho real no SIGA-FV para pagar dentro do sistema. */
export const PAY_IN_APP_PATH = 'Processos → Filiação → Pagar agora';

type EnvGetter = (name: string) => string | undefined;

const defaultEnv: EnvGetter = (name) => {
  // deno-lint-ignore no-explicit-any
  const deno = (globalThis as any).Deno;
  try {
    return deno?.env?.get?.(name) ?? undefined;
  } catch {
    return undefined;
  }
};

/** URL base da aplicação: APP_URL → SITE_URL → domínio novo (sem barra final). */
export function getAppUrl(env: EnvGetter = defaultEnv): string {
  const raw = (env('APP_URL') || env('SITE_URL') || DEFAULT_APP_URL).trim();
  return raw.replace(/\/+$/, '') || DEFAULT_APP_URL;
}

export function getLoginUrl(env: EnvGetter = defaultEnv): string {
  return `${getAppUrl(env)}/#/login`;
}

/** Perfis tratados como associado/cliente (os restantes recebem o texto de colaborador). */
export function isMemberProfile(profile: unknown): boolean {
  const v = String(profile ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return ['cliente', 'client', 'associado', 'associada', 'associado(a)', 'member'].includes(v);
}

/** Nome do remetente: organização AI (ou sem organização indicada, pois o texto é da AI) → AI. */
export function senderNameForOrg(orgId?: string | null): string {
  if (!orgId || orgId === AI_ORG_ID) return AI_SENDER_NAME;
  return DEFAULT_SENDER_NAME;
}

/** Cabeçalho "from" do Resend com o nome entre aspas (evita problemas com vírgulas/traços). */
export function formatFrom(displayName: string, address: string): string {
  const safeName = displayName.replace(/["\\\r\n<>]/g, '').trim();
  return `"${safeName}" <${address.trim()}>`;
}

export type SignupOrigin = 'site' | 'self' | 'admin';

/** Origem do registo a partir do campo `source` usado nas funções. */
export function signupOriginFromSource(source: unknown): SignupOrigin {
  const v = String(source ?? '').toLowerCase();
  if (/vainaai|wix|site|associate|formul[aá]rio externo|website/.test(v)) return 'site';
  if (/registro_direto|registo_direto|register/.test(v)) return 'self';
  return 'admin';
}

export type MemberWelcomeInput = {
  fullName?: string | null;
  email: string;
  loginUrl?: string | null;
  paymentUrl?: string | null;
  origin?: SignupOrigin;
  /** true quando a senha foi escolhida pela própria pessoa (formulário/registo). */
  passwordDefinedByUser?: boolean;
  /** Senha provisória definida pela Direção (só é mostrada se passwordDefinedByUser for falso). */
  temporaryPassword?: string | null;
  /** true quando o termo de adesão segue em anexo. */
  hasAttachment?: boolean;
};

export type EmailContent = { subject: string; text: string; html: string };

const firstNonEmpty = (...values: Array<string | null | undefined>) =>
  values.map((v) => (v ?? '').trim()).find((v) => v.length > 0) ?? '';

const introByOrigin: Record<SignupOrigin, string> = {
  site: 'Recebemos a sua proposta de filiação enviada pelo site vainaai.pt. Obrigado por se juntar à luta contra as injustiças!',
  self: 'Recebemos a sua proposta de filiação enviada pelo SIGA-FV. Obrigado por se juntar à luta contra as injustiças!',
  admin: 'A Direção registou a sua proposta de filiação. Obrigado por se juntar à luta contra as injustiças!',
};

export function buildMemberWelcomeLines(input: MemberWelcomeInput): string[] {
  const name = firstNonEmpty(input.fullName) || 'associado(a)';
  const loginUrl = firstNonEmpty(input.loginUrl) || `${DEFAULT_APP_URL}/#/login`;
  const paymentUrl = firstNonEmpty(input.paymentUrl);
  const origin = input.origin ?? 'site';
  const temp = firstNonEmpty(input.temporaryPassword);

  let passwordLine: string;
  if (input.passwordDefinedByUser) {
    passwordLine = '🔑 **Senha:** a que definiu no formulário';
  } else if (temp) {
    passwordLine = `🔑 **Senha provisória:** ${temp}`;
  } else {
    passwordLine = '🔑 **Senha:** a definida no momento do registo';
  }

  return [
    `Olá, ${name},`,
    '',
    introByOrigin[origin],
    '',
    'O seu acesso ao **SIGA-FV**, o sistema da Associação, já está criado:',
    '',
    `🔐 **Login:** ${input.email}`,
    passwordLine,
    `👉 **Entrar:** ${loginUrl}`,
    '',
    '**Para concluir a filiação, falta apenas um passo:** o pagamento da **Taxa contributiva associativa anual de 30 €**.',
    ...(paymentUrl
      ? [
          `💳 **Pagar agora:** ${paymentUrl}`,
          `Também pode pagar mais tarde dentro do sistema, em *${PAY_IN_APP_PATH}*.`,
        ]
      : [`Pode pagar dentro do sistema, em *${PAY_IN_APP_PATH}*.`]),
    '',
    'Assim que o pagamento for confirmado, receberá um e-mail de confirmação, e o seu estado passa a **Associado efetivo**.',
    ...(input.hasAttachment
      ? ['', 'Em anexo segue o **Termo de Adesão** (PDF), com as regras do regulamento interno e o tratamento dos seus dados segundo o RGPD.']
      : []),
    '',
    '⚠️ Por segurança, altere a sua senha no primeiro acesso.',
    '',
    `Dúvidas: WhatsApp **${AI_WHATSAPP}** · ${AI_EMAIL}`,
    '',
    'Com os melhores cumprimentos,',
    'A Direção da ASSOCIAÇÃO CONTRA AS INJUSTIÇAS – AI',
    `${AI_ADDRESS} · NIPC ${AI_NIPC}`,
    'vainaai.pt · Delegações: Braga – Leiria – Lisboa – Porto',
  ];
}

export const MEMBER_WELCOME_SUBJECT = 'Bem-vindo(a) à Associação contra as Injustiças – os seus dados de acesso ao SIGA-FV';
export const MEMBER_TUTORIAL_SUBJECT = 'Guia rápido do SIGA-FV – como concluir a sua filiação na AI';

export function buildMemberTutorialLines(input: { fullName?: string | null; loginUrl?: string | null }): string[] {
  const name = firstNonEmpty(input.fullName) || 'associado(a)';
  const loginUrl = firstNonEmpty(input.loginUrl) || `${DEFAULT_APP_URL}/#/login`;
  return [
    `Olá, ${name},`,
    '',
    'Este guia mostra, passo a passo, tudo o que pode fazer no SIGA-FV.',
    '',
    '**SUMÁRIO**',
    '1. Entrar no sistema',
    '2. Alterar a senha',
    '3. O seu painel',
    '4. Escolher o serviço "Taxa contributiva associativa anual"',
    '5. Pagar os 30 €',
    '6. Confirmação do pagamento',
    '7. Acompanhar processos, enviar documentos e pedir ajuda',
    '',
    `**1. Entrar.** Abra ${loginUrl}, escreva o seu e-mail e a sua senha e clique em *Entrar*.`,
    '',
    '**2. Alterar a senha.** No ecrã de login, clique em *Esqueci minha senha* para receber por e-mail um link seguro e defina a nova senha no botão *Atualizar senha*. Use a mesma opção se a esquecer.',
    '',
    `**3. O seu painel.** Mostra os seus dados e os seus processos (menu *Processos*). Encontrará já criado o processo **"Filiação - ${name}"**, com o estado *Aguardando pagamento*.`,
    '',
    '**4. Serviço.** O processo de filiação já tem o serviço **Taxa contributiva associativa anual** associado. Não precisa de escolher nada. Se o serviço não aparecer, abra o processo e selecione-o na lista de serviços.',
    '',
    '**5. Pagamento (30 €).** Abra o processo em *Processos* e clique em **Pagar agora**, ou use o botão do e-mail de boas-vindas. Abre-se a página segura da Stripe. Indique o cartão e confirme. O valor apresentado é **30,00 €**.',
    '',
    '**6. Confirmação.** Quando a Stripe confirma o pagamento, o sistema faz automaticamente o seguinte:',
    '- marca o processo como **Pago**;',
    '- envia-lhe um e-mail com a confirmação;',
    '- avisa a Direção da AI e a administração do SIGA-FV.',
    '',
    'A partir daí é **Associado efetivo**. Guarde o recibo da Stripe.',
    '',
    '**7. No dia a dia** pode:',
    '- acompanhar o estado dos seus processos;',
    '- enviar documentos (identificação, comprovativo de morada, quando forem pedidos);',
    '- atualizar os seus dados;',
    '- ver o histórico de pagamentos;',
    '- contactar a Associação.',
    '',
    `Precisa de ajuda? WhatsApp **${AI_WHATSAPP}** · ${AI_EMAIL}`,
    '',
    'A Direção da AI',
  ];
}

// ---------------------------------------------------------------------------
// Renderização: as linhas usam **negrito**, *itálico*, URLs e itens "- ".
// ---------------------------------------------------------------------------

export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Versão em texto simples (remove a marcação de ênfase). */
export function renderPlainText(lines: string[]): string {
  return lines.map((l) => l.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')).join('\n');
}

function inlineHtml(line: string): string {
  let out = escapeHtmlText(line);
  out = out.replace(/(https?:\/\/[^\s<]+[^\s<.,;:)])/g, (url) => `<a href="${url}" style="color:#1d4ed8;">${url}</a>`);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, '$1<em>$2</em>');
  return out;
}

/** Versão HTML: parágrafos separados por linhas vazias; linhas "- " viram listas. */
export function renderHtml(lines: string[]): string {
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push(`<p style="margin:0 0 14px;">${paragraph.join('<br>')}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push(`<ul style="margin:0 0 14px;padding-left:20px;">${list.map((i) => `<li>${i}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const raw of lines) {
    if (raw.trim() === '') {
      flushParagraph();
      flushList();
    } else if (raw.startsWith('- ')) {
      flushParagraph();
      list.push(inlineHtml(raw.slice(2)));
    } else {
      flushList();
      paragraph.push(inlineHtml(raw));
    }
  }
  flushParagraph();
  flushList();
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:640px;">${blocks.join('\n')}</div>`;
}

export function buildMemberWelcomeEmail(input: MemberWelcomeInput): EmailContent {
  const lines = buildMemberWelcomeLines(input);
  return { subject: MEMBER_WELCOME_SUBJECT, text: renderPlainText(lines), html: renderHtml(lines) };
}

export function buildMemberTutorialEmail(input: { fullName?: string | null; loginUrl?: string | null }): EmailContent {
  const lines = buildMemberTutorialLines(input);
  return { subject: MEMBER_TUTORIAL_SUBJECT, text: renderPlainText(lines), html: renderHtml(lines) };
}
