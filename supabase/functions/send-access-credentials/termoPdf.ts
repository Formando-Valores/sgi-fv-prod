import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const TERMO_LINES = [
  'TERMO DE ADESÃO DO NOVO ASSOCIADO EFETIVO',
  '',
  'Segundo o regulamento interno da associação, a entrada e permanência de novos usuários no sistema eletrônico da associação obedecem as seguintes razões que porventura a Presidência ou a Direção possam entender aplicáveis ao caso, como as diretrizes assim discriminadas abaixo, que constam neste termo de adesão do novo associado efetivo na associação, concordando este com os requisitos enumerados, nomeadamente:',
  '',
  '1. Adepto ao objeto e finalidades da associação prescritos no Estatuto Social;',
  '',
  '2. Tem interesse em atuar e/ou ser assistido pela associação;',
  '',
  '3. Permite que a associação tenha acesso as suas informações pessoais de identificação, moradia e pesquisa na rede mundial de computadores e órgãos públicos a respeito de sua pessoa e seu cumprimento legal, autorizando este acesso em total consentimento as normas da LGPD;',
  '',
  '4. Tem ciência e presta consentimento de que pode a qualquer tempo, ser excluído da associação por não estar envolvido nas questões ligadas ao objeto e fim da associação ou por deliberação da Presidência ou da Direção, aquando este associado esteja somente usufruindo de algum serviço da associação que já se consumou e ou não efetuou o pagamento da jóia e ou quota anual para a sua manutenção na associação, assim definido os valores pela Direção;',
  '',
  '5. Efetuou o preenchimento e envio da proposta de filiação e/ou termo de parceria por correio eletrônico, pelo o sitio eletrônico ou através de um dos associados fundadores ou efetivos em delegação de competência, e foi encaminhado à conhecimento da Direção ou Presidência, que aceitando o novo associado, o registra neste ato;',
  '',
  '6. Tem ciência de que pode, no ato de análise da proposta de adesão, termo de parceria ou após o seu registo para fins de atualização, ser requerido pela associação a apresentação de documento de identificação oficial e ou comprovativo de morada atualizado, como outros documentos que se entendam necessários para conferência, e havendo a escusa deste ou que julgue conveniente a Presidência ou Direção, a possibilidade de recusa de sua adesão ou a sua exclusão da associação.',
  '',
  'A direção agradece com muito gosto a sua adesão a AI, pois é mais um apoiador na luta contra as injustiças em Portugal e na Europa.',
  '',
  'A Direção da ASSOCIAÇÃO CONTRA AS INJUSTIÇAS – AI',
  'Avenida Dom Dinis, n.º 68 A – Centro Comercial Oceano – Odivelas – Sala 28 – Lisboa – Código Postal 2675-328',
  'NIPC 518920747',
  'Sítio eletrónico: vainaai.pt | E-mail: contato@vainaai.pt.',
  'Delegações: Braga - Leiria - Lisboa - Porto',
];

export async function generateTermoPdf(nomeAssociado: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  let y = height - 50;
  const marginLeft = 50;
  const maxWidth = width - 100;
  const fontSize = 10;
  const lineHeight = 14;

  const drawWrappedText = (text: string, bold: boolean = false) => {
    const f = bold ? fontBold : font;
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(testLine, fontSize) > maxWidth) {
        page.drawText(line, { x: marginLeft, y, size: fontSize, font: f, color: rgb(0, 0, 0) });
        y -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: marginLeft, y, size: fontSize, font: f, color: rgb(0, 0, 0) });
      y -= lineHeight;
    }
  };

  page.drawText('TERMO DE ADESÃO DO NOVO ASSOCIADO EFETIVO', {
    x: marginLeft, y, size: 14, font: fontBold, color: rgb(0, 0, 0),
  });
  y -= 24;

  const dataStr = `Data: ${new Date().toLocaleDateString('pt-PT')}`;
  page.drawText(dataStr, { x: marginLeft, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
  y -= 18;

  page.drawText(`Associado: ${nomeAssociado}`, {
    x: marginLeft, y, size: 10, font: fontBold, color: rgb(0, 0, 0),
  });
  y -= 24;

  for (const line of TERMO_LINES) {
    if (!line) {
      y -= lineHeight;
      continue;
    }
    const isTitle = line === line.toUpperCase() && line.length > 5;
    drawWrappedText(line, isTitle);
  }

  y -= 30;

  page.drawText('____________________________________', { x: marginLeft, y, size: 10, font, color: rgb(0, 0, 0) });
  y -= 14;
  page.drawText(`Assinatura do Associado: ${nomeAssociado}`, { x: marginLeft, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });

  return pdfDoc.save();
}
