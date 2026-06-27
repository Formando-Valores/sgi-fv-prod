import type { ServiceUnit } from '../../types';

export type CatalogService = {
  id: string;
  name: string;
  group: string;
  description: string;
  unit: ServiceUnit;
  price: number;
};

export const CUSTOM_ANALYSIS_FEE = 280;

// Taxas Associativas (valores em BRL, convertidos de EUR a taxa ~6.0)
export const ASSOCIATION_ANNUAL_FEE = 180;   // 30€ * 6
export const ASSOCIATION_CONVENIO_01_FEE = 60;    // 10€ * 6, ate 100€
export const ASSOCIATION_CONVENIO_02_FEE = 150;   // 25€ * 6, de 101€ a 300€
export const ASSOCIATION_CONVENIO_03_FEE = 300;   // 50€ * 6, de 301€ a 700€
export const ASSOCIATION_CONVENIO_04_FEE = 450;   // 75€ * 6, de 701€ a 2000€ ou mais
export const ASSOCIATION_CONVENIO_THRESHOLD_01 = 600;   // 100€ * 6
export const ASSOCIATION_CONVENIO_THRESHOLD_02 = 1800;  // 300€ * 6
export const ASSOCIATION_CONVENIO_THRESHOLD_03 = 4200;  // 700€ * 6

export type AssociationFeeItem = {
  type: 'annual' | 'convenio' | 'doacao';
  name: string;
  price: number;
  destination: 'association';
};

/**
 * Calcula as taxas associativas.
 * - membership: apenas Taxa Anual (30€) — para filiacao
 * - service: apenas Convenio conforme faixa de valor dos servicos
 */
export function calcAssociationFees(servicesTotal: number, context: 'membership' | 'service' = 'service'): AssociationFeeItem[] {
  if (context === 'membership') {
    return [
      { type: 'annual', name: 'Taxa Associativa Anual', price: ASSOCIATION_ANNUAL_FEE, destination: 'association' },
    ];
  }
  // Service context: convenio fee conforme faixas
  if (servicesTotal <= ASSOCIATION_CONVENIO_THRESHOLD_01) {
    return [{ type: 'convenio', name: 'Convênio 01 (até €100)', price: ASSOCIATION_CONVENIO_01_FEE, destination: 'association' }];
  }
  if (servicesTotal <= ASSOCIATION_CONVENIO_THRESHOLD_02) {
    return [{ type: 'convenio', name: 'Convênio 02 (€101 a €300)', price: ASSOCIATION_CONVENIO_02_FEE, destination: 'association' }];
  }
  if (servicesTotal <= ASSOCIATION_CONVENIO_THRESHOLD_03) {
    return [{ type: 'convenio', name: 'Convênio 03 (€301 a €700)', price: ASSOCIATION_CONVENIO_03_FEE, destination: 'association' }];
  }
  return [{ type: 'convenio', name: 'Convênio 04 (€701 ou mais)', price: ASSOCIATION_CONVENIO_04_FEE, destination: 'association' }];
}

/**
 * Retorna o valor liquido ao profissional apos deduzir as taxas associativas.
 * (venda casada: o preco do servico ja inclui a taxa, que e deduzida do repasse)
 */
export function calcProfessionalNet(servicesTotal: number, fees: AssociationFeeItem[]): number {
  return servicesTotal - fees.reduce((sum, f) => sum + f.price, 0);
}

export const SERVICE_CATALOG: CatalogService[] = [
  // ── ADMINISTRATIVO ─ Serviços Avulsos ──
  { id: 'adm-1', name: 'Consulta Oral/Online', group: 'Serviços Avulsos', description: 'Honorário mínimo: €50', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 300 },
  { id: 'adm-2', name: 'Consulta S/ Marcação - Urgente', group: 'Serviços Avulsos', description: 'Honorário mínimo: €75', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 450 },
  { id: 'adm-3', name: 'Consultas Subsequentes', group: 'Serviços Avulsos', description: 'Honorário mínimo: €50', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 300 },
  { id: 'adm-4', name: 'Consulta Escrita', group: 'Serviços Avulsos', description: 'Honorário mínimo: €100', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 600 },
  { id: 'adm-5', name: 'Consulta Presencial com Análise e/ou Elaboração de Documentos', group: 'Serviços Avulsos', description: 'Valor médio: €80 a €300', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 1140 },
  { id: 'adm-6', name: 'Certificação ou Termo de Autenticação de Documento', group: 'Serviços Avulsos', description: 'Valor médio: €15 a €25', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 120 },
  { id: 'adm-7', name: 'Reconhecimento de Assinatura', group: 'Serviços Avulsos', description: 'Valor médio: €10 a €15', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 75 },
  { id: 'adm-8', name: 'Estudo Sistemático da Situação Fática Apresentada', group: 'Serviços Avulsos', description: 'Honorário mínimo: €100', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 600 },
  { id: 'adm-9', name: 'Elaboração de Informação Escrita (Parecer Jurídico)', group: 'Serviços Avulsos', description: 'Honorário mínimo: €150', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 900 },
  { id: 'adm-10', name: 'Elaboração de Mera Informação Escrita', group: 'Serviços Avulsos', description: 'Honorário mínimo: €100', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 600 },
  { id: 'adm-11', name: 'Preparação, Assistência e Requisição de Atos Notariais', group: 'Serviços Avulsos', description: 'Honorário mínimo: €150', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 900 },
  { id: 'adm-12', name: 'Impugnação Judicial de Contra-Ordenação', group: 'Serviços Avulsos', description: 'Honorário mínimo: €150', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 900 },
  { id: 'adm-13', name: 'Reclamação de Créditos em Processo de Insolvência', group: 'Serviços Avulsos', description: 'Honorário mínimo: €250', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 1500 },
  { id: 'adm-14', name: 'Honorários para Mandato Forense', group: 'Serviços Avulsos', description: 'Valor médio: €60 a €200', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 780 },
  { id: 'adm-15', name: 'Inspeção ao Local na Comarca', group: 'Serviços Avulsos', description: 'Honorário mínimo: €60', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 360 },
  { id: 'adm-16', name: 'Inspeção ao Local fora da Comarca (excluído transporte)', group: 'Serviços Avulsos', description: 'Valor médio: €80 a €100', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 540 },
  { id: 'adm-17', name: 'Notificação Judicial e Extrajudicial', group: 'Serviços Avulsos', description: 'Valor médio: €100 a €150', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 750 },
  { id: 'adm-18', name: 'Requerimento Avulso de Mero Expediente', group: 'Serviços Avulsos', description: 'Honorário mínimo: €50', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 300 },
  { id: 'adm-19', name: 'Requerimento Avulso com Questões de Fundo', group: 'Serviços Avulsos', description: 'Honorário mínimo: €80', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 480 },
  { id: 'adm-20', name: 'Compra e Venda de Automóvel', group: 'Serviços Avulsos', description: 'Honorário mínimo: €65', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 390 },
  { id: 'adm-21', name: 'Extinção de Reserva (sem atuação junto ao banco)', group: 'Serviços Avulsos', description: 'Honorário mínimo: €35', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 210 },
  { id: 'adm-22', name: 'Extinção de Locação (notificação para desocupação)', group: 'Serviços Avulsos', description: 'Honorário mínimo: €65', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 390 },
  { id: 'adm-23', name: 'Pedido 2ª Via do Certificado de Matrícula', group: 'Serviços Avulsos', description: 'Honorário mínimo: €37', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 222 },
  { id: 'adm-24', name: 'Cancelamento de Penhora', group: 'Serviços Avulsos', description: 'Honorário mínimo: €110', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 660 },
  { id: 'adm-25', name: 'Compra e Venda de Veículo até 50cm³', group: 'Serviços Avulsos', description: 'Honorário mínimo: €35', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 210 },
  { id: 'adm-26', name: 'Renovação Carta de Condução (senha AT)', group: 'Serviços Avulsos', description: 'Honorário mínimo: €37', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 222 },
  { id: 'adm-27', name: 'Legalização de Viatura Importada UE', group: 'Serviços Avulsos', description: 'Honorário mínimo: €250', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 1500 },
  { id: 'adm-28', name: 'Legalização de Viatura Importada c/ Alteração Residência UE', group: 'Serviços Avulsos', description: 'Honorário mínimo: €250', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 1500 },
  { id: 'adm-29', name: 'Legalização de Viatura Importada p/ Pessoa com Deficiência UE', group: 'Serviços Avulsos', description: 'Honorário mínimo: €400', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 2400 },
  { id: 'adm-30', name: 'Admissão Temporária UE', group: 'Serviços Avulsos', description: 'Honorário mínimo: €175', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 1050 },
  { id: 'adm-31', name: 'Alteração de Características (películas)', group: 'Serviços Avulsos', description: 'Honorário mínimo: €190', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 1140 },
  { id: 'adm-32', name: 'Alteração de Características (pneus/cor)', group: 'Serviços Avulsos', description: 'Honorário mínimo: €70', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 420 },
  { id: 'adm-33', name: 'Celebração de Contrato de Arrendamento', group: 'Serviços Avulsos', description: 'Honorário mínimo: €50', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 300 },
  { id: 'adm-34', name: 'Cessação do Contrato de Arrendamento', group: 'Serviços Avulsos', description: 'Honorário mínimo: €50', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 300 },
  { id: 'adm-35', name: 'Interpelação de Rendas em Atraso', group: 'Serviços Avulsos', description: 'Honorário mínimo: €50', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 300 },
  { id: 'adm-36', name: 'Contrato de Trabalho', group: 'Serviços Avulsos', description: 'Honorário mínimo: €50', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 300 },
  { id: 'adm-37', name: 'Denúncia por Iniciativa do Trabalhador/Empregador', group: 'Serviços Avulsos', description: 'Valor médio: €25 a €50', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 225 },
  { id: 'adm-38', name: 'Contrato de Promessa de Compra e Venda', group: 'Serviços Avulsos', description: 'Honorário mínimo: €60', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 360 },
  { id: 'adm-39', name: 'Certidão de Nascimento/Casamento/Óbito', group: 'Serviços Avulsos', description: 'Honorário mínimo: €22', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 132 },
  { id: 'adm-40', name: 'Alteração de Morada', group: 'Serviços Avulsos', description: 'Honorário mínimo: €35', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 210 },

  // ── JURÍDICO / ADVOCACIA ─ Processos Judiciais ──
  { id: 'jur-proc-1', name: 'Comum Singular', group: 'Processos Judiciais', description: 'Honorário mínimo: €500', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 3000 },
  { id: 'jur-proc-2', name: 'Comum Coletivo', group: 'Processos Judiciais', description: 'Honorário mínimo: €1000', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 6000 },
  { id: 'jur-proc-3', name: 'Transgressão', group: 'Processos Judiciais', description: 'Honorário mínimo: €200', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 1200 },
  { id: 'jur-proc-4', name: 'Transgressão no Tribunal do Trabalho', group: 'Processos Judiciais', description: 'Honorário mínimo: €250', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 1500 },
  { id: 'jur-proc-5', name: 'Sumário', group: 'Processos Judiciais', description: 'Honorário mínimo: €250', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 1500 },
  { id: 'jur-proc-6', name: 'Ação Sumaríssima', group: 'Processos Judiciais', description: 'Honorário mínimo: €150', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 900 },
  { id: 'jur-proc-7', name: 'Ação Sumária', group: 'Processos Judiciais', description: 'Honorário mínimo: €600', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 3600 },
  { id: 'jur-proc-8', name: 'Ação Ordinária', group: 'Processos Judiciais', description: 'Honorário mínimo: €1000', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 6000 },
  { id: 'jur-proc-9', name: 'Divórcio por Mútuo Consentimento', group: 'Processos Judiciais', description: 'Honorário mínimo: €500', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 3000 },
  { id: 'jur-proc-10', name: 'Divórcio Litigioso não Contestado', group: 'Processos Judiciais', description: 'Valor médio: €500 a €800', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 3900 },
  { id: 'jur-proc-11', name: 'Serviço de Mediação de Conflitos', group: 'Processos Judiciais', description: 'Valor médio: €50 a €250', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 900 },
  { id: 'jur-proc-12', name: 'Termo de Acordo', group: 'Processos Judiciais', description: 'Valor médio: €50 a €250', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 900 },

  // ── JURÍDICO / ADVOCACIA ─ Recursos ──
  { id: 'jur-rec-1', name: 'Recurso para Relação sem Julgamento', group: 'Recursos', description: 'Honorário mínimo: €500', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 3000 },
  { id: 'jur-rec-2', name: 'Recurso para Relação com Julgamento', group: 'Recursos', description: 'Honorário mínimo: €1000', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 6000 },
  { id: 'jur-rec-3', name: 'Recurso para STJ sem Julgamento', group: 'Recursos', description: 'Honorário mínimo: €750', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 4500 },
  { id: 'jur-rec-4', name: 'Recurso para STJ com Julgamento', group: 'Recursos', description: 'Honorário mínimo: €1500', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 9000 },
  { id: 'jur-rec-5', name: 'Recurso para Tribunal Constitucional', group: 'Recursos', description: 'Honorário mínimo: €1000', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 6000 },

  // ── JURÍDICO / ADVOCACIA ─ Direito Administrativo ──
  { id: 'jur-dir-adm-1', name: 'Recurso Hierárquico', group: 'Direito Administrativo', description: 'Honorário mínimo: €500', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 3000 },
  { id: 'jur-dir-adm-2', name: 'Recurso Contencioso', group: 'Direito Administrativo', description: 'Honorário mínimo: €1000', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 6000 },

  // ── JURÍDICO / ADVOCACIA ─ Direito Empresarial ──
  { id: 'jur-emp-1', name: 'Abertura de Empresa', group: 'Direito Empresarial', description: 'Honorário mínimo: €350', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 2100 },
  { id: 'jur-emp-2', name: 'Contrato Social/Estatuto Social e Alterações', group: 'Direito Empresarial', description: 'Honorário mínimo: €250', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 1500 },
  { id: 'jur-emp-3', name: 'Avença Mensal (10 consultas, 10 certificações, 10 pareceres)', group: 'Direito Empresarial', description: 'Valor médio: €300 a €700', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 3000 },
  { id: 'jur-emp-4', name: 'Abertura de Atividade Independente', group: 'Direito Empresarial', description: 'Honorário mínimo: €250', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 1500 },
  { id: 'jur-emp-5', name: 'Representante Fiscal e Alterações', group: 'Direito Empresarial', description: 'Honorário mínimo: €50', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 300 },
  { id: 'jur-emp-6', name: 'Apoio em Rescisão, Cálculos e Defesa Trabalhista', group: 'Direito Empresarial', description: 'Valor médio: €50 a €100', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 450 },
  { id: 'jur-emp-7', name: 'Atuação em Execuções, Insolvências e Leilões', group: 'Direito Empresarial', description: 'Valor médio: €50 a €100', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 450 },
  { id: 'jur-emp-8', name: 'Acompanhamento em Repartições Públicas e Privadas', group: 'Direito Empresarial', description: 'Valor médio: €50 a €150', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 600 },
  { id: 'jur-emp-9', name: 'Declaração de IRS', group: 'Direito Empresarial', description: 'Valor médio: €100 a €150', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 750 },
  { id: 'jur-emp-10', name: 'Registo de Beneficiário Efetivo', group: 'Direito Empresarial', description: 'Honorário mínimo: €300', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 1800 },
  { id: 'jur-emp-11', name: 'Pedido de Abertura de Conta Bancária', group: 'Direito Empresarial', description: 'Honorário mínimo: €300', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 1800 },
  { id: 'jur-emp-12', name: 'Pedido de Registo de Startups no IAPMEI', group: 'Direito Empresarial', description: 'Honorário mínimo: €1300', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 7800 },

  // ── JURÍDICO / ADVOCACIA ─ Imigração ──
  { id: 'jur-imm-1', name: 'Assessoria para Aquisição de Documentos', group: 'Imigração', description: 'Valor médio: €45 a €100', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 435 },
  { id: 'jur-imm-2', name: 'Processo de Nacionalidade Portuguesa', group: 'Imigração', description: 'Valor médio: €500 a €700', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 3600 },
  { id: 'jur-imm-3', name: 'Pedido de Autorização de Residência na AIMA', group: 'Imigração', description: 'Honorário mínimo: €400', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 2400 },
  { id: 'jur-imm-4', name: 'Pedido de Renovação de Autorização de Residência na AIMA', group: 'Imigração', description: 'Honorário mínimo: €300', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 1800 },
  { id: 'jur-imm-5', name: 'Pedido de Visto nas Embaixadas Portuguesas', group: 'Imigração', description: 'Honorário mínimo: €500', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 3000 },
  { id: 'jur-imm-6', name: 'Prorrogação de Visto', group: 'Imigração', description: 'Honorário mínimo: €300', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 1800 },
  { id: 'jur-imm-7', name: 'Alterações e Atualizações de Dados na AIMA', group: 'Imigração', description: 'Honorário mínimo: €150', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 900 },
  { id: 'jur-imm-8', name: 'Defesa em Audiência Prévia', group: 'Imigração', description: 'Honorário mínimo: €350', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 2100 },
  { id: 'jur-imm-9', name: 'Requerimento para Junção de Documentos na AIMA', group: 'Imigração', description: 'Honorário mínimo: €120', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 720 },
  { id: 'jur-imm-10', name: 'Pedido de NIF', group: 'Imigração', description: 'Honorário mínimo: €90', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 540 },
  { id: 'jur-imm-11', name: 'Pedido de NISS', group: 'Imigração', description: 'Honorário mínimo: €180', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 1080 },
  { id: 'jur-imm-12', name: 'Pedido de Cartão de Residência para Cidadãos Europeus ou Familiares', group: 'Imigração', description: 'Honorário mínimo: €350', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 2100 },
  { id: 'jur-imm-13', name: 'Outros Serviços de Imigração não Relacionados', group: 'Imigração', description: 'Valor médio: €100 a €250', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 1050 },

  // ── JURÍDICO / ADVOCACIA ─ Direito Fiscal ──
  { id: 'jur-fis-1', name: 'Ação Administrativa Comum', group: 'Direito Fiscal', description: 'Honorário mínimo: €1000', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 6000 },
  { id: 'jur-fis-2', name: 'Ação Cautelar', group: 'Direito Fiscal', description: 'Honorário mínimo: €1200', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 7200 },
  { id: 'jur-fis-3', name: 'Oposição a Execução', group: 'Direito Fiscal', description: 'Honorário mínimo: €1200', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 7200 },
  { id: 'jur-fis-4', name: 'Impugnação Judicial', group: 'Direito Fiscal', description: 'Honorário mínimo: €1200', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 7200 },
  { id: 'jur-fis-5', name: 'Reclamação a Penhora', group: 'Direito Fiscal', description: 'Honorário mínimo: €400', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 2400 },
  { id: 'jur-fis-6', name: 'Requerimento para Providências Legais', group: 'Direito Fiscal', description: 'Honorário mínimo: €350', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 2100 },
  { id: 'jur-fis-7', name: 'Requerimento de Revisão', group: 'Direito Fiscal', description: 'Honorário mínimo: €300', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 1800 },
  { id: 'jur-fis-8', name: 'Reclamação Judicial em sede de Oposição a Execução', group: 'Direito Fiscal', description: 'Honorário mínimo: €500', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 3000 },
  { id: 'jur-fis-9', name: 'Ação de Intimação', group: 'Direito Fiscal', description: 'Honorário mínimo: €1200', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 7200 },
  { id: 'jur-fis-10', name: 'Oposição à Execução + Impugnação Judicial', group: 'Direito Fiscal', description: 'Honorário mínimo: €1800', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 10800 },
  { id: 'jur-fis-11', name: 'Oposição à Execução + Impugnação Judicial + Ação Cautelar', group: 'Direito Fiscal', description: 'Honorário mínimo: €2500', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 15000 },
  { id: 'jur-fis-12', name: 'Oposição à Execução + Impugnação Judicial + Ação Cautelar + Ação Administrativa Especial', group: 'Direito Fiscal', description: 'Honorário mínimo: €3600', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 21600 },
  { id: 'jur-fis-13', name: 'Reclamação à Penhora + Oposição à Penhora', group: 'Direito Fiscal', description: 'Honorário mínimo: €1500', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 9000 },
  { id: 'jur-fis-14', name: 'Reclamação Graciosa', group: 'Direito Fiscal', description: 'Honorário mínimo: €300', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 1800 },
  { id: 'jur-fis-15', name: 'Outras Defesas do Contribuinte', group: 'Direito Fiscal', description: 'Valor médio: €300 a €700', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 3000 },

  // ── TECNOLÓGICO / AI ──
  { id: 'tec-1', name: 'Desenvolvimento Web', group: 'Tecnologia', description: 'Criação de site ou sistema web', unit: 'TECNOLÓGICO / AI' as ServiceUnit, price: 5000 },
  { id: 'tec-2', name: 'Aplicativo Mobile', group: 'Tecnologia', description: 'Desenvolvimento de aplicativo mobile', unit: 'TECNOLÓGICO / AI' as ServiceUnit, price: 8000 },
  { id: 'tec-3', name: 'Consultoria em IA', group: 'Tecnologia', description: 'Consultoria em inteligência artificial', unit: 'TECNOLÓGICO / AI' as ServiceUnit, price: 3500 },
  { id: 'tec-4', name: 'Automação de Processos', group: 'Tecnologia', description: 'Automação de processos empresariais', unit: 'TECNOLÓGICO / AI' as ServiceUnit, price: 4500 },
  { id: 'tec-5', name: 'Manutenção de Sistema', group: 'Tecnologia', description: 'Manutenção corretiva/evolutiva de sistema', unit: 'TECNOLÓGICO / AI' as ServiceUnit, price: 2000 },
  { id: 'tec-6', name: 'Infraestrutura Cloud', group: 'Tecnologia', description: 'Projeto e implantação de infraestrutura cloud', unit: 'TECNOLÓGICO / AI' as ServiceUnit, price: 6000 },
];

export function getServicesByUnit(unit: ServiceUnit): CatalogService[] {
  return SERVICE_CATALOG.filter((s) => s.unit === unit);
}

export function getGroupsByUnit(unit: ServiceUnit): string[] {
  const groups = new Set<string>();
  for (const s of SERVICE_CATALOG) {
    if (s.unit === unit) groups.add(s.group);
  }
  return Array.from(groups);
}

export function getServicesByGroup(unit: ServiceUnit, group: string): CatalogService[] {
  return SERVICE_CATALOG.filter((s) => s.unit === unit && s.group === group);
}
