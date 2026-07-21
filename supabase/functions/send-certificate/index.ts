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

function generateCertificateHtml(params: {
  nome: string;
  nacionalidade: string;
  estadoCivil: string;
  dataNascimento: string;
  naturalidade: string;
  documento: string;
  docTipo: string;
  validadeDoc: string;
  nif: string;
  niss: string;
  morada: string;
  protocolo: string;
  dataFiliacao: string;
  certNumber: string;
  verifCode: string;
  appUrl: string;
  processId: string;
}): string {
  const p = params;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
    <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border:2px solid #d4a843;border-radius:8px;">
      <!-- HEADER -->
      <tr>
        <td style="padding:32px 40px 16px;text-align:center;border-bottom:3px double #d4a843;">
          <h1 style="color:#1e3a5f;font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:3px;margin:0 0 4px;">Certificado de Filiação</h1>
          <p style="color:#d4a843;font-size:12px;font-weight:700;letter-spacing:2px;margin:0 0 4px;">ASSOCIAÇÃO CONTRA AS INJUSTIÇAS - AI</p>
          <p style="color:#6b7280;font-size:11px;margin:0;">NIPC: XXXXXXXX · Sede: [Morada da Sede] · Lisboa – Portugal</p>
        </td>
      </tr>
      <!-- CERTIFICATE NUMBER -->
      <tr>
        <td style="padding:24px 40px 0;text-align:center;">
          <p style="color:#9ca3af;font-size:11px;font-weight:700;letter-spacing:2px;margin:0 0 4px;">N.º DE CERTIFICADO</p>
          <p style="color:#1e3a5f;font-size:18px;font-weight:900;margin:0;">${p.certNumber}</p>
        </td>
      </tr>
      <!-- BODY -->
      <tr>
        <td style="padding:24px 40px;">
          <p style="color:#374151;font-size:14px;line-height:1.8;margin:0 0 20px;text-align:justify;">
            A <strong>Associação contra as Injustiças - AI</strong>, pessoa coletiva n.º XXXXXXXX, com sede na
            [Morada da Sede], Lisboa – Portugal, certifica para os devidos efeitos que:
          </p>
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:20px;margin-bottom:20px;">
            <table width="100%" cellpadding="4" cellspacing="0" style="font-size:13px;color:#374151;">
              <tr>
                <td width="35%" style="font-weight:600;color:#1e3a5f;padding:3px 8px;">Nome Completo:</td>
                <td style="font-weight:700;padding:3px 8px;">${p.nome}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#1e3a5f;padding:3px 8px;">Nacionalidade:</td>
                <td style="padding:3px 8px;">${p.nacionalidade}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#1e3a5f;padding:3px 8px;">Estado Civil:</td>
                <td style="padding:3px 8px;">${p.estadoCivil}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#1e3a5f;padding:3px 8px;">Data de Nascimento:</td>
                <td style="padding:3px 8px;">${p.dataNascimento}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#1e3a5f;padding:3px 8px;">Naturalidade:</td>
                <td style="padding:3px 8px;">${p.naturalidade}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#1e3a5f;padding:3px 8px;">Documento:</td>
                <td style="padding:3px 8px;">${p.docTipo} n.º ${p.documento}${p.validadeDoc ? ` (válido até ${p.validadeDoc})` : ''}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#1e3a5f;padding:3px 8px;">NIF:</td>
                <td style="padding:3px 8px;">${p.nif}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#1e3a5f;padding:3px 8px;">NISS:</td>
                <td style="padding:3px 8px;">${p.niss}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#1e3a5f;padding:3px 8px;">Morada:</td>
                <td style="padding:3px 8px;">${p.morada}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#1e3a5f;padding:3px 8px;">Protocolo:</td>
                <td style="padding:3px 8px;">${p.protocolo}</td>
              </tr>
              <tr>
                <td style="font-weight:600;color:#1e3a5f;padding:3px 8px;">Data de Filiação:</td>
                <td style="padding:3px 8px;">${p.dataFiliacao}</td>
              </tr>
            </table>
          </div>
          <p style="color:#374151;font-size:14px;line-height:1.8;margin:0;text-align:justify;">
            que o(a) identificado(a) nos termos supra se encontra devidamente registado(a) como
            <strong>associado(a) efetivo(a)</strong> da Associação contra as Injustiças - AI, com todos os direitos
            e deveres previstos nos Estatutos e no Regulamento Interno da Associação.
          </p>
        </td>
      </tr>
      <!-- VERIFICATION -->
      <tr>
        <td style="padding:0 40px 16px;text-align:center;">
          <div style="background:#f9fafb;border:1px dashed #d1d5db;border-radius:6px;padding:12px;display:inline-block;">
            <p style="color:#6b7280;font-size:10px;font-weight:700;letter-spacing:1px;margin:0 0 4px;">CÓDIGO DE VERIFICAÇÃO</p>
            <p style="color:#1e3a5f;font-size:14px;font-weight:900;font-family:monospace;margin:0;">${p.verifCode}</p>
            <p style="color:#9ca3af;font-size:9px;margin:4px 0 0;">Verifique em: ${p.appUrl}/#/certificate/${p.processId}</p>
          </div>
        </td>
      </tr>
      <!-- SIGNATURES -->
      <tr>
        <td style="padding:16px 40px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:50%;text-align:center;padding:0 8px;">
                <div style="border-top:1px solid #374151;padding:8px 0 0;margin-bottom:4px;"></div>
                <p style="color:#1e3a5f;font-size:12px;font-weight:700;margin:0;">O Presidente da Direção</p>
                <p style="color:#6b7280;font-size:10px;margin:0;">(assinatura digital)</p>
              </td>
              <td style="width:50%;text-align:center;padding:0 8px;">
                <div style="border-top:1px solid #374151;padding:8px 0 0;margin-bottom:4px;"></div>
                <p style="color:#1e3a5f;font-size:12px;font-weight:700;margin:0;">O Secretário</p>
                <p style="color:#6b7280;font-size:10px;margin:0;">(assinatura digital)</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- FOOTER -->
      <tr>
        <td style="background:#f9fafb;padding:16px 40px;text-align:center;border-top:2px solid #d4a843;">
          <p style="color:#9ca3af;font-size:10px;margin:0;">Documento gerado eletronicamente pelo SGI FV – Sistema de Gestão Integrada</p>
          <p style="color:#9ca3af;font-size:10px;margin:4px 0 0;">Emissão: ${new Date().toLocaleDateString('pt-PT')} · Válido com apresentação do código de verificação</p>
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
    const { processId, clientEmail: bodyClientEmail } = await request.json();

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
      .select('cliente_nome, protocolo, created_at, services_selected, cliente_user_id, org_id, cliente_email, cliente_documento')
      .eq('id', processId)
      .single();

    if (processError || !process) {
      return jsonResponse(404, { success: false, error: 'Processo não encontrado.' });
    }

    let userEmail = process.cliente_email || '';
    let profileData: Record<string, unknown> = {};

    if (process.cliente_user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', process.cliente_user_id)
        .maybeSingle();
      if (profile) {
        profileData = profile;
        userEmail = profile.email || userEmail;
      }
    }

    if (!userEmail && process.cliente_documento) {
      const doc = process.cliente_documento.trim();
      const { data: profileByDoc } = await supabase
        .from('profiles')
        .select('email')
        .or(`nif_cpf.eq.${doc},documento_identidade.eq.${doc}`)
        .limit(1)
        .maybeSingle();
      userEmail = profileByDoc?.email || '';
    }

    if (!userEmail && process.cliente_nome) {
      const { data: profileByName } = await supabase
        .from('profiles')
        .select('email')
        .eq('nome_completo', process.cliente_nome.trim())
        .limit(1)
        .maybeSingle();
      userEmail = profileByName?.email || '';
    }

    if (!userEmail && bodyClientEmail) {
      userEmail = bodyClientEmail;
    }

    if (!userEmail) {
      return jsonResponse(400, { success: false, error: 'E-mail do cliente não encontrado. Cadastre um e-mail no perfil do cliente ou no formulário de criação do processo.' });
    }

    const nome = process.cliente_nome || (profileData as any).nome_completo || 'Associado';
    const protocolo = process.protocolo || 'N/A';
    const data = new Date(process.created_at).toLocaleDateString('pt-PT');

    // Generate certificate number and verification code
    const year = new Date().getFullYear();
    const initials = (nome as string).split(' ').map((n: string) => n[0] || '').join('').toUpperCase().slice(0, 4) || 'XX';
    const seq = protocolo.replace(/\D/g, '').slice(-4) || Math.floor(Math.random() * 9000 + 1000).toString();
    const certNumber = `AI-${year}/${seq}`;
    const verifCode = `AI-${year}-${seq}-${initials}`;

    const certParams = {
      nome: nome as string,
      nacionalidade: (profileData as any).nacionalidade || '-',
      estadoCivil: (profileData as any).estado_civil || '-',
      dataNascimento: (profileData as any).data_nascimento || '-',
      naturalidade: (profileData as any).naturalidade || '-',
      documento: (profileData as any).documento_identidade || '-',
      docTipo: (profileData as any).tipo_documento || 'CC',
      validadeDoc: (profileData as any).validade_documento || '',
      nif: (profileData as any).nif_cpf || '-',
      niss: (profileData as any).niss || '-',
      morada: (profileData as any).endereco || (profileData as any).codigo_postal ? `${(profileData as any).endereco || ''}, ${(profileData as any).codigo_postal || ''}` : '-',
      protocolo,
      dataFiliacao: data,
      certNumber,
      verifCode,
      appUrl,
      processId,
    };

    const certificateHtml = generateCertificateHtml(certParams);
    const textBody = [
      `Certificado de Filiação - ${nome}`,
      '',
      `N.º: ${certNumber}`,
      `Código de Verificação: ${verifCode}`,
      `Protocolo: ${protocolo}`,
      `Data de Filiação: ${data}`,
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
        subject: `Certificado de Filiação n.º ${certNumber} - ${nome}`,
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
