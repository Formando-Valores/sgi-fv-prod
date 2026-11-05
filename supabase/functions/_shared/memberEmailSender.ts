/**
 * Envio, via Resend, dos dois e-mails ao associado/cliente:
 *   E-mail 1 — dados de acesso (com o Termo de Adesão em PDF, quando possível);
 *   E-mail 2 — guia rápido do SIGA-FV, enviado logo a seguir ao E-mail 1.
 *
 * Usado por send-access-credentials, wix-client-intake e create-process-client-user
 * (create-user delega em send-access-credentials).
 */
import { generateTermoPdf } from './termoPdf.ts';
import {
  buildMemberTutorialEmail,
  buildMemberWelcomeEmail,
  formatFrom,
  getLoginUrl,
  senderNameForOrg,
  type EmailContent,
  type SignupOrigin,
} from './memberEmails.ts';

export type ResendConfig = { resendApiKey: string; from: string; replyTo: string };

export function getResendConfig(): ResendConfig | null {
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? Deno.env.get('ACCESS_EMAIL_API_KEY') ?? '';
  const from = Deno.env.get('FROM_EMAIL') ?? Deno.env.get('ACCESS_EMAIL_FROM') ?? '';
  const replyTo = Deno.env.get('ACCESS_EMAIL_REPLY_TO') ?? '';
  if (!resendApiKey || !from) return null;
  return { resendApiKey, from, replyTo };
}

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

export async function sendResendEmail(
  config: ResendConfig,
  params: {
    to: string[];
    senderName: string;
    content: EmailContent;
    attachments?: Array<{ filename: string; content: string }>;
  },
): Promise<SendResult> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: formatFrom(params.senderName, config.from),
        to: params.to,
        reply_to: config.replyTo || undefined,
        subject: params.content.subject,
        html: params.content.html,
        text: params.content.text,
        ...(params.attachments?.length ? { attachments: params.attachments } : {}),
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, error: errorText || response.statusText };
    }
    const body = await response.json().catch(() => ({}));
    return { ok: true, id: typeof body?.id === 'string' ? body.id : undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'erro desconhecido' };
  }
}

async function termoAttachment(recipientName: string) {
  try {
    const bytes = new Uint8Array(await generateTermoPdf(recipientName));
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return [{ filename: 'termo-associado.pdf', content: btoa(binary) }];
  } catch {
    console.error('[memberEmailSender] erro ao gerar PDF do termo de associado, enviando sem anexo');
    return [];
  }
}

export type MemberEmailsPayload = {
  email: string;
  fullName?: string;
  loginUrl?: string;
  paymentUrl?: string;
  orgId?: string | null;
  origin?: SignupOrigin;
  passwordDefinedByUser?: boolean;
  temporaryPassword?: string;
  attachTermo?: boolean;
};

export type MemberEmailsResult =
  | { ok: true; welcomeId?: string; tutorialOk: boolean; tutorialError?: string }
  | { ok: false; error: string };

/** Envia o E-mail 1 e, se este for aceite pela Resend, o E-mail 2 (tutorial). */
export async function sendMemberWelcomeAndTutorial(payload: MemberEmailsPayload): Promise<MemberEmailsResult> {
  const config = getResendConfig();
  if (!config) {
    return { ok: false, error: 'Serviço de e-mail não configurado. Defina RESEND_API_KEY e FROM_EMAIL.' };
  }

  const loginUrl = payload.loginUrl?.trim() || getLoginUrl();
  const fullName = payload.fullName?.trim() || '';
  const senderName = senderNameForOrg(payload.orgId);
  const attachments = payload.attachTermo === false ? [] : await termoAttachment(fullName || 'associado(a)');

  const welcome = buildMemberWelcomeEmail({
    fullName,
    email: payload.email,
    loginUrl,
    paymentUrl: payload.paymentUrl,
    origin: payload.origin,
    passwordDefinedByUser: payload.passwordDefinedByUser,
    temporaryPassword: payload.temporaryPassword,
    hasAttachment: attachments.length > 0,
  });

  const first = await sendResendEmail(config, { to: [payload.email], senderName, content: welcome, attachments });
  if (!first.ok) {
    return { ok: false, error: `Falha ao enviar e-mail de credenciais: ${first.error}` };
  }

  const tutorial = buildMemberTutorialEmail({ fullName, loginUrl });
  const second = await sendResendEmail(config, { to: [payload.email], senderName, content: tutorial });
  if (!second.ok) {
    console.error('[memberEmailSender] falha ao enviar o e-mail 2 (tutorial)', { error: second.error });
  }
  return { ok: true, welcomeId: first.id, tutorialOk: second.ok, tutorialError: second.ok ? undefined : second.error };
}
