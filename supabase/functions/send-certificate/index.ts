import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function generateCertificateHtml(nome: string, protocolo: string, data: string, servicos: string, appUrl: string, processId: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.12);">
      <tr>
        <td style="background:linear-gradient(135deg,#1e3a5f,#1e40af);padding:48px 32px;text-align:center;">
          <h1 style="color:#ffffff;font-size:24px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 4px;">Certificado de Filiação</h1>
          <p style="color:#93c5fd;font-size:13px;margin:0;">Associação Formando Valores</p>
        </td>
      </tr>
      <tr>
        <td style="padding:40px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding-bottom:24px;">
              <p style="color:#6b7280;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;">Certificamos que</p>
              <h2 style="color:#111827;font-size:22px;font-weight:900;margin:0 0 16px;">${nome}</h2>
              <div style="width:64px;height:2px;background:#2563eb;margin:0 auto 16px;"></div>
              <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
                é associado(a) da <strong>Associação Formando Valores</strong>, tendo concluído o processo de filiação.
              </p>
            </td></tr>
            <tr><td style="background:#f9fafb;border-radius:12px;padding:20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;font-weight:600;">Protocolo:</span></td>
                  <td style="padding:4px 0;text-align:right;"><span style="color:#111827;font-size:13px;font-weight:700;">${protocolo}</span></td>
                </tr>
                <tr>
                  <td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;font-weight:600;">Data de Filiação:</span></td>
                  <td style="padding:4px 0;text-align:right;"><span style="color:#111827;font-size:13px;font-weight:700;">${data}</span></td>
                </tr>
                <tr>
                  <td style="padding:4px 0;"><span style="color:#6b7280;font-size:13px;font-weight:600;">Serviços:</span></td>
                  <td style="padding:4px 0;text-align:right;"><span style="color:#111827;font-size:13px;font-weight:700;">${servicos}</span></td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 32px;text-align:center;">
          <a href="${appUrl}/#/certificate?processId=${processId}"
             style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:12px;font-size:13px;font-weight:700;">
            Acessar Certificado Online
          </a>
        </td>
      </tr>
      <tr>
        <td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:11px;margin:0;">SGI FV - Sistema de Gestão Integrada</p>
          <p style="color:#9ca3af;font-size:11px;margin:4px 0 0;">Este é um e-mail automático. Não responda a esta mensagem.</p>
        </td>
      </tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Método não permitido.' });
  }

  try {
    const { processId } = await request.json();

    if (!processId) {
      return jsonResponse(400, { success: false, error: 'processId é obrigatório.' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? Deno.env.get('ACCESS_EMAIL_FROM') ?? '';
    const appUrl = Deno.env.get('APP_URL') ?? Deno.env.get('SITE_URL') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { success: false, error: 'Configuração do Supabase ausente.' });
    }

    if (!resendApiKey || !fromEmail) {
      return jsonResponse(500, { success: false, error: 'Configuração de e-mail ausente.' });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: process, error: processError } = await supabase
      .from('processes')
      .select('cliente_nome, protocolo, created_at, services_selected, cliente_user_id, org_id')
      .eq('id', processId)
      .single();

    if (processError || !process) {
      return jsonResponse(404, { success: false, error: 'Processo não encontrado.' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('nome_completo, email')
      .eq('id', process.cliente_user_id)
      .single();

    const userEmail = profile?.email || '';
    if (!userEmail) {
      return jsonResponse(400, { success: false, error: 'E-mail do cliente não encontrado.' });
    }

    const servicos = (process.services_selected as any[]) || [];
    const nomesServicos = servicos.map((s: any) => s.name).join(', ') || 'Filiação';
    const nome = process.cliente_nome || profile?.nome_completo || 'Associado';
    const protocolo = process.protocolo || 'N/A';
    const data = new Date(process.created_at).toLocaleDateString('pt-BR');

    const certificateHtml = generateCertificateHtml(nome, protocolo, data, nomesServicos, appUrl, processId);
    const textBody = [
      `Certificado de Filiação - ${nome}`,
      '',
      `Protocolo: ${protocolo}`,
      `Data: ${data}`,
      `Serviços: ${nomesServicos}`,
      '',
      `Acesse: ${appUrl}/#/certificate?processId=${processId}`,
    ].join('\n');

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `SGI FV <${fromEmail}>`,
        to: [userEmail],
        subject: `Certificado de Filiação - ${nome}`,
        html: certificateHtml,
        text: textBody,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('[send-certificate] erro resend:', emailResponse.status, errorText);
      return jsonResponse(500, { success: false, error: `Erro ao enviar email: ${errorText || emailResponse.statusText}` });
    }

    await supabase.from('process_events').insert({
      org_id: process.org_id,
      process_id: processId,
      tipo: 'status_change',
      mensagem: `Certificado de filiação enviado por e-mail para ${userEmail}.`,
      event_code: 'certificate_sent',
    });

    return jsonResponse(200, { success: true, email: userEmail });
  } catch (err) {
    console.error('[send-certificate] erro inesperado:', err);
    return jsonResponse(500, { success: false, error: `Erro interno: ${err instanceof Error ? err.message : 'desconhecido'}` });
  }
});
