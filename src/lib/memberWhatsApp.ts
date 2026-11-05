/**
 * Mensagem de boas-vindas por WhatsApp (envio manual via wa.me).
 * Texto aprovado (tutorial_associado_siga-fv.md, secção 5), com os nomes reais
 * dos botões do SIGA-FV.
 */

export const DEFAULT_APP_URL = 'https://sgi-fv-prod-one.vercel.app';
export const PAY_IN_APP_PATH = 'Processos → Filiação → Pagar agora';

/** URL base da aplicação: VITE_APP_URL → domínio novo (sem barra final). */
export function getFrontendAppUrl(envValue?: string | null): string {
  const raw = String(envValue ?? '').trim().replace(/\/+$/, '');
  return raw || DEFAULT_APP_URL;
}

export function getFrontendLoginUrl(envValue?: string | null): string {
  return `${getFrontendAppUrl(envValue)}/#/login`;
}

export type WhatsAppWelcomeInput = {
  fullName?: string | null;
  email: string;
  loginUrl: string;
  paymentUrl?: string | null;
};

export function buildWhatsAppWelcomeMessage(input: WhatsAppWelcomeInput): string {
  const name = String(input.fullName ?? '').replace(/\s+/g, ' ').trim();
  const paymentUrl = String(input.paymentUrl ?? '').trim();
  return [
    `Olá${name ? ` ${name}` : ''}! 👋 Bem-vindo(a) à Associação contra as Injustiças – AI.`,
    '',
    '✅ O seu acesso ao SIGA-FV foi criado.',
    `🔐 Login: ${input.email}`,
    '🔑 Senha: a que definiu no site',
    `👉 ${input.loginUrl}`,
    '',
    '📌 Para concluir a filiação:',
    '1️⃣ Entre no sistema',
    '2️⃣ Abra o processo "Filiação"',
    '3️⃣ Serviço: Taxa contributiva associativa anual',
    '4️⃣ Clique em PAGAR AGORA → 30,00 € (pagamento seguro Stripe)',
    '5️⃣ Recebe a confirmação por e-mail e passa a Associado efetivo 🎉',
    '',
    paymentUrl ? `💳 Pagar já: ${paymentUrl}` : `💳 Pagar já: no sistema, em ${PAY_IN_APP_PATH}`,
    '📖 Guia completo: enviado para o seu e-mail',
    '❓ Dúvidas: responda a esta mensagem.',
  ].join('\n');
}

/**
 * Normaliza um telefone para o formato do wa.me (só dígitos, com indicativo).
 * Números portugueses de 9 dígitos (9xxxxxxxx / 2xxxxxxxx) recebem o indicativo 351.
 * Devolve '' quando o número não é utilizável.
 */
export function normalizeWhatsAppPhone(raw?: string | null): string {
  const value = String(raw ?? '').trim();
  if (!value || value === '---') return '';
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 9 && /^[29]/.test(digits) && !value.startsWith('+')) digits = `351${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

/** Link wa.me com a mensagem pré-preenchida (sem número quando não há telefone válido). */
export function buildWhatsAppUrl(message: string, phone?: string | null): string {
  const number = normalizeWhatsAppPhone(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
