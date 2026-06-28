import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { adminEmail, userName, userEmail } = await request.json();

    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const from = Deno.env.get('FROM_EMAIL') ?? Deno.env.get('ACCESS_EMAIL_FROM') ?? '';
    const replyTo = Deno.env.get('ACCESS_EMAIL_REPLY_TO') ?? '';

    if (!resendApiKey || !from) {
      console.error('[notify-pending-registration] RESEND_API_KEY ou FROM_EMAIL não configurados');
      return new Response(JSON.stringify({ success: false, error: 'Email não configurado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resend = new Resend(resendApiKey);
    const appUrl = Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://sgi-fv-prod.vercel.app';
    const adminUrl = `${appUrl}/#/dashboard/configuracoes`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #d97706; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px;">SGI FV</h1>
        </div>
        <div style="padding: 32px 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #1e293b; font-size: 16px;">Olá,</p>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            Um novo cadastro está pendente de aprovação no sistema.
          </p>

          <div style="background: #ffffff; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0; border-left: 4px solid #d97706;">
            <h3 style="color: #92400e; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Dados do Cadastro</h3>
            <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>Nome:</strong> ${userName}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>Email:</strong> ${userEmail}</p>
          </div>

          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            Acesse o painel administrativo para revisar e aprovar este cadastro.
          </p>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${adminUrl}" style="display: inline-block; background: #d97706; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">
              Revisar Cadastros
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Este é um e-mail automático do SGI FV - Formando Valores.
          </p>
        </div>
      </div>
    `;

    const { error } = await resend.emails.send({
      from,
      to: adminEmail,
      replyTo: replyTo || undefined,
      subject: `Novo cadastro pendente: ${userName} - SGI FV`,
      html,
    });

    if (error) {
      console.error('[notify-pending-registration] Erro ao enviar email:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[notify-pending-registration] Erro inesperado:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
