export type AccessEmailPayload = {
  email: string;
  fullName?: string;
  loginUrl?: string;
  source?: string;
  profile?: string;
  temporaryPassword?: string;
};

export type PasswordResetEmailPayload = {
  email: string;
  fullName?: string;
  loginUrl?: string;
  resetUrl: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getEmailConfig = () => {
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const from = Deno.env.get('FROM_EMAIL') ?? Deno.env.get('ACCESS_EMAIL_FROM') ?? '';
  const replyTo = Deno.env.get('ACCESS_EMAIL_REPLY_TO') ?? '';

  if (!resendApiKey || !from) {
    return null;
  }

  return { resendApiKey, from, replyTo };
};

export async function sendAccessCredentialsEmail(payload: AccessEmailPayload) {
  const emailConfig = getEmailConfig();

  if (!emailConfig) {
    return {
      ok: false,
      error: 'Serviço de e-mail não configurado. Defina RESEND_API_KEY e FROM_EMAIL.',
    };
  }

  const recipientName = payload.fullName?.trim() || 'cliente';
  const loginUrl = payload.loginUrl?.trim() || 'https://sgi-fv-prod.vercel.app/#/login';
  const profileLabel = payload.profile?.trim() || 'USUÁRIO OPERADOR';
  const temporaryPassword = payload.temporaryPassword?.trim() || 'Definida no momento do cadastro';

  const bodyLines = [
    `Olá, ${recipientName},`,
    '',
    'Seja bem-vindo ao SIGA-FV.',
    '',
    `Você foi cadastrado no sistema SIGA-FV como ${profileLabel}.`,
    'A Direção efetuou o seu pré-cadastro com sucesso para ser nosso USUÁRIO OPERADOR do sistema SIGA-FV da Associação contra as Injustiças - AI e atuar nas atividades dos quais foi convocado em correio eletrônico e/ou termo de parceria.',
    '',
    'Para dar continuidade ao seu atendimento e acessar o seu processo administrativo, utilize os dados abaixo:',
    '',
    `🔐 Login: ${payload.email}`,
    '',
    `🔑 Senha provisória: ${temporaryPassword}`,
    '',
    '👉 Acesse o sistema:',
    '',
    loginUrl,
    '',
    '- No sistema você poderá:',
    '',
    'Gerenciar clientes,',
    'Acompanhar processos,',
    'Inserir informações e documentos,',
    'Executar serviços conforme sua função.',
    '',
    '⚠️ Por segurança, altere sua senha no primeiro acesso.',
    '',
    'Caso tenha dúvidas, entre em contato com o administrador da organização.',
    '',
    '⚠️ Importa também lembrar que qualquer dúvida ou esclarecimento pode ser resolvido através de mensagem por whatsapp para +351 916 068 515 e/ou pelo correio eletrônico contato@vainaai.pt',
    '',
    'Este pré-cadastro resulta na confirmação do seu vínculo com a associação que luta pela defesa dos seus direitos.',
    '',
    'Oportuno indicar que a tramitação dos seus dados foram de livre vontade para a entidade e que essas informações serão guardadas e utilizadas segundo o RGPD.',
    '',
    'Segundo o regulamento interno da associação, a entrada e permanência de novos usuários no sistema eletrônico da associação obedecem as seguintes razões que porventura a Presidência ou a Direção possam entender aplicáveis ao caso, como as diretrizes assim discriminadas abaixo, que constam neste termo de adesão do novo associado efetivo na associação, concordando este com os requisitos enumerados, nomeadamente:',
    '',
    'Adepto ao objeto e finalidades da associação prescritos no Estatuto Social,',
    'Tem interesse em atuar e/ou ser assistido pela associação,',
    'Permite que a associação tenha acesso as suas informações pessoais de identificação, moradia e pesquisa na rede mundial de computadores e órgãos públicos a respeito de sua pessoa e seu cumprimento legal, autorizando este acesso em total consentimento as normas da LGPD,',
    'Tem ciência e presta consentimento de que pode a qualquer tempo, ser excluído da associação por não estar envolvido nas questões ligadas ao objeto e fim da associação ou por deliberação da Presidência ou da Direção, aquando este associado esteja somente usufruindo de algum serviço da associação que já se consumou e ou não efetuou o pagamento da jóia e ou quota anual para a sua manutenção na associação, assim definido os valores pela Direção,',
    'Efetuou o preenchimento e envio da proposta de filiação e/ou termo de parceria por correio eletrônico, pelo o sitio eletrônico ou através de um dos associados fundadores ou efetivos em delegação de competência, e foi encaminhado à conhecimento da Direção ou Presidência, que aceitando o novo associado, o registra neste ato,',
    'Tem ciência de que pode, no ato de análise da proposta de adesão, termo de parceria ou após o seu registo para fins de atualização, ser requerido pela associação a apresentação de documento de identificação oficial e ou comprovativo de morada atualizado, como outros documentos que se entendam necessários para conferência, e havendo a escusa deste ou que julgue conveniente a Presidência ou Direção, a possibilidade de recusa de sua adesão ou a sua exclusão da associação.',
    '',
    'A direção agradece com muito gosto a sua adesão a AI, pois é mais um apoiador na luta contra as injustiças em Portugal e na Europa.',
    '',
    'Estamos à disposição para ajudá-lo.',
    '',
    'Com os melhores cumprimentos,',
    '',
    'Equipe SIGA-FV',
    '',
    'A Direção da ASSOCIAÇÃO CONTRA AS INJUSTIÇAS – AI',
    '',
    'Avenida Dom Dinis, n.º 68 A – Centro Comercial Oceano – Odivelas – Sala 28 – Lisboa – Código Postal 2675-328',
    '',
    'NIPC 518920747',
    '',
    'Sítio eletrónico: vainaai.pt | E-mail: contato@vainaai.pt.',
    '',
    'Delegações:',
    '',
    'Braga - Leiria - Lisboa - Porto',
  ];

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.7;color:#0f172a;white-space:pre-line;">
      ${bodyLines.map((line) => escapeHtml(line)).join('\n')}
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${emailConfig.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Formando Valores <${emailConfig.from}>`,
      to: [payload.email],
      reply_to: emailConfig.replyTo || undefined,
      subject: 'Bem-vindo ao SIGA-FV - Dados de acesso',
      html,
      text: bodyLines.join('\n'),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      error: `Falha ao enviar e-mail de credenciais: ${errorText || response.statusText}`,
    };
  }

  return { ok: true };
}

export async function sendPasswordResetEmail(payload: PasswordResetEmailPayload) {
  const emailConfig = getEmailConfig();

  if (!emailConfig) {
    return {
      ok: false,
      error: 'Serviço de e-mail não configurado. Defina RESEND_API_KEY e FROM_EMAIL.',
    };
  }

  const recipientName = payload.fullName?.trim() || 'cliente';
  const loginUrl = payload.loginUrl?.trim() || 'https://sgi-fv-prod.vercel.app/#/login';
  const resetUrl = payload.resetUrl.trim();

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2>Redefinição de senha</h2>
      <p>Olá, <strong>${escapeHtml(recipientName)}</strong>.</p>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta na plataforma Formando Valores.</p>
      <p>Para criar uma nova senha com segurança, clique no botão abaixo:</p>
      <p style="margin:24px 0;">
        <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;">
          Redefinir minha senha
        </a>
      </p>
      <p>Se você não solicitou esta alteração, pode ignorar este e-mail.</p>
      <p>Após redefinir sua senha, você poderá acessar a plataforma em:</p>
      <p><a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${emailConfig.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Formando Valores <${emailConfig.from}>`,
      to: [payload.email],
      reply_to: emailConfig.replyTo || undefined,
      subject: 'Redefinição de senha - Formando Valores',
      html,
      text: [
        `Olá, ${recipientName}.`,
        'Recebemos uma solicitação para redefinir a senha da sua conta na plataforma Formando Valores.',
        `Abra este link para redefinir sua senha: ${resetUrl}`,
        `Depois disso, acesse: ${loginUrl}`,
        'Se você não solicitou esta alteração, ignore este e-mail.',
      ].join('\n'),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      ok: false,
      error: `Falha ao enviar e-mail de redefinição: ${errorText || response.statusText}`,
    };
  }

  return { ok: true };
}
