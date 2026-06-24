-- ============================================
-- SGI FV - Migration 034: Update Services Catalog
-- Adds group column, replaces seed data with
-- PDF-based services converted from EUR to BRL
-- ============================================

-- Add group/subcategory column
ALTER TABLE public.services_catalog ADD COLUMN IF NOT EXISTS "group" text;

-- Clear old seed data
DELETE FROM public.services_catalog;

-- Insert updated catalog (EUR → BRL at ~6.0 rate)
INSERT INTO public.services_catalog (org_id, name, description, unit, price, "group") VALUES

-- ── ADMINISTRATIVO ─ Serviços Avulsos ──
(NULL, 'Consulta Oral/Online', 'Honorário mínimo: €50', 'ADMINISTRATIVO', 300.00, 'Serviços Avulsos'),
(NULL, 'Consulta S/ Marcação - Urgente', 'Honorário mínimo: €75', 'ADMINISTRATIVO', 450.00, 'Serviços Avulsos'),
(NULL, 'Consultas Subsequentes', 'Honorário mínimo: €50', 'ADMINISTRATIVO', 300.00, 'Serviços Avulsos'),
(NULL, 'Consulta Escrita', 'Honorário mínimo: €100', 'ADMINISTRATIVO', 600.00, 'Serviços Avulsos'),
(NULL, 'Consulta Presencial com Análise e/ou Elaboração de Documentos', 'Valor médio: €80 a €300', 'ADMINISTRATIVO', 1140.00, 'Serviços Avulsos'),
(NULL, 'Certificação ou Termo de Autenticação de Documento', 'Valor médio: €15 a €25', 'ADMINISTRATIVO', 120.00, 'Serviços Avulsos'),
(NULL, 'Reconhecimento de Assinatura', 'Valor médio: €10 a €15', 'ADMINISTRATIVO', 75.00, 'Serviços Avulsos'),
(NULL, 'Estudo Sistemático da Situação Fática Apresentada', 'Honorário mínimo: €100', 'ADMINISTRATIVO', 600.00, 'Serviços Avulsos'),
(NULL, 'Elaboração de Informação Escrita (Parecer Jurídico)', 'Honorário mínimo: €150', 'ADMINISTRATIVO', 900.00, 'Serviços Avulsos'),
(NULL, 'Elaboração de Mera Informação Escrita', 'Honorário mínimo: €100', 'ADMINISTRATIVO', 600.00, 'Serviços Avulsos'),
(NULL, 'Preparação, Assistência e Requisição de Atos Notariais', 'Honorário mínimo: €150', 'ADMINISTRATIVO', 900.00, 'Serviços Avulsos'),
(NULL, 'Impugnação Judicial de Contra-Ordenação', 'Honorário mínimo: €150', 'ADMINISTRATIVO', 900.00, 'Serviços Avulsos'),
(NULL, 'Reclamação de Créditos em Processo de Insolvência', 'Honorário mínimo: €250', 'ADMINISTRATIVO', 1500.00, 'Serviços Avulsos'),
(NULL, 'Honorários para Mandato Forense', 'Valor médio: €60 a €200', 'ADMINISTRATIVO', 780.00, 'Serviços Avulsos'),
(NULL, 'Inspeção ao Local na Comarca', 'Honorário mínimo: €60', 'ADMINISTRATIVO', 360.00, 'Serviços Avulsos'),
(NULL, 'Inspeção ao Local fora da Comarca (excluído transporte)', 'Valor médio: €80 a €100', 'ADMINISTRATIVO', 540.00, 'Serviços Avulsos'),
(NULL, 'Notificação Judicial e Extrajudicial', 'Valor médio: €100 a €150', 'ADMINISTRATIVO', 750.00, 'Serviços Avulsos'),
(NULL, 'Requerimento Avulso de Mero Expediente', 'Honorário mínimo: €50', 'ADMINISTRATIVO', 300.00, 'Serviços Avulsos'),
(NULL, 'Requerimento Avulso com Questões de Fundo', 'Honorário mínimo: €80', 'ADMINISTRATIVO', 480.00, 'Serviços Avulsos'),
(NULL, 'Compra e Venda de Automóvel', 'Honorário mínimo: €65', 'ADMINISTRATIVO', 390.00, 'Serviços Avulsos'),
(NULL, 'Extinção de Reserva (sem atuação junto ao banco)', 'Honorário mínimo: €35', 'ADMINISTRATIVO', 210.00, 'Serviços Avulsos'),
(NULL, 'Extinção de Locação (notificação para desocupação)', 'Honorário mínimo: €65', 'ADMINISTRATIVO', 390.00, 'Serviços Avulsos'),
(NULL, 'Pedido 2ª Via do Certificado de Matrícula', 'Honorário mínimo: €37', 'ADMINISTRATIVO', 222.00, 'Serviços Avulsos'),
(NULL, 'Cancelamento de Penhora', 'Honorário mínimo: €110', 'ADMINISTRATIVO', 660.00, 'Serviços Avulsos'),
(NULL, 'Compra e Venda de Veículo até 50cm³', 'Honorário mínimo: €35', 'ADMINISTRATIVO', 210.00, 'Serviços Avulsos'),
(NULL, 'Renovação Carta de Condução (senha AT)', 'Honorário mínimo: €37', 'ADMINISTRATIVO', 222.00, 'Serviços Avulsos'),
(NULL, 'Legalização de Viatura Importada UE', 'Honorário mínimo: €250', 'ADMINISTRATIVO', 1500.00, 'Serviços Avulsos'),
(NULL, 'Legalização de Viatura Importada c/ Alteração Residência UE', 'Honorário mínimo: €250', 'ADMINISTRATIVO', 1500.00, 'Serviços Avulsos'),
(NULL, 'Legalização de Viatura Importada p/ Pessoa com Deficiência UE', 'Honorário mínimo: €400', 'ADMINISTRATIVO', 2400.00, 'Serviços Avulsos'),
(NULL, 'Admissão Temporária UE', 'Honorário mínimo: €175', 'ADMINISTRATIVO', 1050.00, 'Serviços Avulsos'),
(NULL, 'Alteração de Características (películas)', 'Honorário mínimo: €190', 'ADMINISTRATIVO', 1140.00, 'Serviços Avulsos'),
(NULL, 'Alteração de Características (pneus/cor)', 'Honorário mínimo: €70', 'ADMINISTRATIVO', 420.00, 'Serviços Avulsos'),
(NULL, 'Celebração de Contrato de Arrendamento', 'Honorário mínimo: €50', 'ADMINISTRATIVO', 300.00, 'Serviços Avulsos'),
(NULL, 'Cessação do Contrato de Arrendamento', 'Honorário mínimo: €50', 'ADMINISTRATIVO', 300.00, 'Serviços Avulsos'),
(NULL, 'Interpelação de Rendas em Atraso', 'Honorário mínimo: €50', 'ADMINISTRATIVO', 300.00, 'Serviços Avulsos'),
(NULL, 'Contrato de Trabalho', 'Honorário mínimo: €50', 'ADMINISTRATIVO', 300.00, 'Serviços Avulsos'),
(NULL, 'Denúncia por Iniciativa do Trabalhador/Empregador', 'Valor médio: €25 a €50', 'ADMINISTRATIVO', 225.00, 'Serviços Avulsos'),
(NULL, 'Contrato de Promessa de Compra e Venda', 'Honorário mínimo: €60', 'ADMINISTRATIVO', 360.00, 'Serviços Avulsos'),
(NULL, 'Certidão de Nascimento/Casamento/Óbito', 'Honorário mínimo: €22', 'ADMINISTRATIVO', 132.00, 'Serviços Avulsos'),
(NULL, 'Alteração de Morada', 'Honorário mínimo: €35', 'ADMINISTRATIVO', 210.00, 'Serviços Avulsos'),

-- ── JURÍDICO / ADVOCACIA ─ Processos Judiciais ──
(NULL, 'Comum Singular', 'Honorário mínimo: €500', 'JURÍDICO / ADVOCACIA', 3000.00, 'Processos Judiciais'),
(NULL, 'Comum Coletivo', 'Honorário mínimo: €1000', 'JURÍDICO / ADVOCACIA', 6000.00, 'Processos Judiciais'),
(NULL, 'Transgressão', 'Honorário mínimo: €200', 'JURÍDICO / ADVOCACIA', 1200.00, 'Processos Judiciais'),
(NULL, 'Transgressão no Tribunal do Trabalho', 'Honorário mínimo: €250', 'JURÍDICO / ADVOCACIA', 1500.00, 'Processos Judiciais'),
(NULL, 'Sumário', 'Honorário mínimo: €250', 'JURÍDICO / ADVOCACIA', 1500.00, 'Processos Judiciais'),
(NULL, 'Ação Sumaríssima', 'Honorário mínimo: €150', 'JURÍDICO / ADVOCACIA', 900.00, 'Processos Judiciais'),
(NULL, 'Ação Sumária', 'Honorário mínimo: €600', 'JURÍDICO / ADVOCACIA', 3600.00, 'Processos Judiciais'),
(NULL, 'Ação Ordinária', 'Honorário mínimo: €1000', 'JURÍDICO / ADVOCACIA', 6000.00, 'Processos Judiciais'),
(NULL, 'Divórcio por Mútuo Consentimento', 'Honorário mínimo: €500', 'JURÍDICO / ADVOCACIA', 3000.00, 'Processos Judiciais'),
(NULL, 'Divórcio Litigioso não Contestado', 'Valor médio: €500 a €800', 'JURÍDICO / ADVOCACIA', 3900.00, 'Processos Judiciais'),
(NULL, 'Serviço de Mediação de Conflitos', 'Valor médio: €50 a €250', 'JURÍDICO / ADVOCACIA', 900.00, 'Processos Judiciais'),
(NULL, 'Termo de Acordo', 'Valor médio: €50 a €250', 'JURÍDICO / ADVOCACIA', 900.00, 'Processos Judiciais'),

-- ── JURÍDICO / ADVOCACIA ─ Recursos ──
(NULL, 'Recurso para Relação sem Julgamento', 'Honorário mínimo: €500', 'JURÍDICO / ADVOCACIA', 3000.00, 'Recursos'),
(NULL, 'Recurso para Relação com Julgamento', 'Honorário mínimo: €1000', 'JURÍDICO / ADVOCACIA', 6000.00, 'Recursos'),
(NULL, 'Recurso para STJ sem Julgamento', 'Honorário mínimo: €750', 'JURÍDICO / ADVOCACIA', 4500.00, 'Recursos'),
(NULL, 'Recurso para STJ com Julgamento', 'Honorário mínimo: €1500', 'JURÍDICO / ADVOCACIA', 9000.00, 'Recursos'),
(NULL, 'Recurso para Tribunal Constitucional', 'Honorário mínimo: €1000', 'JURÍDICO / ADVOCACIA', 6000.00, 'Recursos'),

-- ── JURÍDICO / ADVOCACIA ─ Direito Administrativo ──
(NULL, 'Recurso Hierárquico', 'Honorário mínimo: €500', 'JURÍDICO / ADVOCACIA', 3000.00, 'Direito Administrativo'),
(NULL, 'Recurso Contencioso', 'Honorário mínimo: €1000', 'JURÍDICO / ADVOCACIA', 6000.00, 'Direito Administrativo'),

-- ── JURÍDICO / ADVOCACIA ─ Direito Empresarial ──
(NULL, 'Abertura de Empresa', 'Honorário mínimo: €350', 'JURÍDICO / ADVOCACIA', 2100.00, 'Direito Empresarial'),
(NULL, 'Contrato Social/Estatuto Social e Alterações', 'Honorário mínimo: €250', 'JURÍDICO / ADVOCACIA', 1500.00, 'Direito Empresarial'),
(NULL, 'Avença Mensal (10 consultas, 10 certificações, 10 pareceres)', 'Valor médio: €300 a €700', 'JURÍDICO / ADVOCACIA', 3000.00, 'Direito Empresarial'),
(NULL, 'Abertura de Atividade Independente', 'Honorário mínimo: €250', 'JURÍDICO / ADVOCACIA', 1500.00, 'Direito Empresarial'),
(NULL, 'Representante Fiscal e Alterações', 'Honorário mínimo: €50', 'JURÍDICO / ADVOCACIA', 300.00, 'Direito Empresarial'),
(NULL, 'Apoio em Rescisão, Cálculos e Defesa Trabalhista', 'Valor médio: €50 a €100', 'JURÍDICO / ADVOCACIA', 450.00, 'Direito Empresarial'),
(NULL, 'Atuação em Execuções, Insolvências e Leilões', 'Valor médio: €50 a €100', 'JURÍDICO / ADVOCACIA', 450.00, 'Direito Empresarial'),
(NULL, 'Acompanhamento em Repartições Públicas e Privadas', 'Valor médio: €50 a €150', 'JURÍDICO / ADVOCACIA', 600.00, 'Direito Empresarial'),
(NULL, 'Declaração de IRS', 'Valor médio: €100 a €150', 'JURÍDICO / ADVOCACIA', 750.00, 'Direito Empresarial'),
(NULL, 'Registo de Beneficiário Efetivo', 'Honorário mínimo: €300', 'JURÍDICO / ADVOCACIA', 1800.00, 'Direito Empresarial'),
(NULL, 'Pedido de Abertura de Conta Bancária', 'Honorário mínimo: €300', 'JURÍDICO / ADVOCACIA', 1800.00, 'Direito Empresarial'),
(NULL, 'Pedido de Registo de Startups no IAPMEI', 'Honorário mínimo: €1300', 'JURÍDICO / ADVOCACIA', 7800.00, 'Direito Empresarial'),

-- ── JURÍDICO / ADVOCACIA ─ Imigração ──
(NULL, 'Assessoria para Aquisição de Documentos', 'Valor médio: €45 a €100', 'JURÍDICO / ADVOCACIA', 435.00, 'Imigração'),
(NULL, 'Processo de Nacionalidade Portuguesa', 'Valor médio: €500 a €700', 'JURÍDICO / ADVOCACIA', 3600.00, 'Imigração'),
(NULL, 'Pedido de Autorização de Residência na AIMA', 'Honorário mínimo: €400', 'JURÍDICO / ADVOCACIA', 2400.00, 'Imigração'),
(NULL, 'Pedido de Renovação de Autorização de Residência na AIMA', 'Honorário mínimo: €300', 'JURÍDICO / ADVOCACIA', 1800.00, 'Imigração'),
(NULL, 'Pedido de Visto nas Embaixadas Portuguesas', 'Honorário mínimo: €500', 'JURÍDICO / ADVOCACIA', 3000.00, 'Imigração'),
(NULL, 'Prorrogação de Visto', 'Honorário mínimo: €300', 'JURÍDICO / ADVOCACIA', 1800.00, 'Imigração'),
(NULL, 'Alterações e Atualizações de Dados na AIMA', 'Honorário mínimo: €150', 'JURÍDICO / ADVOCACIA', 900.00, 'Imigração'),
(NULL, 'Defesa em Audiência Prévia', 'Honorário mínimo: €350', 'JURÍDICO / ADVOCACIA', 2100.00, 'Imigração'),
(NULL, 'Requerimento para Junção de Documentos na AIMA', 'Honorário mínimo: €120', 'JURÍDICO / ADVOCACIA', 720.00, 'Imigração'),
(NULL, 'Pedido de NIF', 'Honorário mínimo: €90', 'JURÍDICO / ADVOCACIA', 540.00, 'Imigração'),
(NULL, 'Pedido de NISS', 'Honorário mínimo: €180', 'JURÍDICO / ADVOCACIA', 1080.00, 'Imigração'),
(NULL, 'Pedido de Cartão de Residência para Cidadãos Europeus ou Familiares', 'Honorário mínimo: €350', 'JURÍDICO / ADVOCACIA', 2100.00, 'Imigração'),
(NULL, 'Outros Serviços de Imigração não Relacionados', 'Valor médio: €100 a €250', 'JURÍDICO / ADVOCACIA', 1050.00, 'Imigração'),

-- ── JURÍDICO / ADVOCACIA ─ Direito Fiscal ──
(NULL, 'Ação Administrativa Comum', 'Honorário mínimo: €1000', 'JURÍDICO / ADVOCACIA', 6000.00, 'Direito Fiscal'),
(NULL, 'Ação Cautelar', 'Honorário mínimo: €1200', 'JURÍDICO / ADVOCACIA', 7200.00, 'Direito Fiscal'),
(NULL, 'Oposição a Execução', 'Honorário mínimo: €1200', 'JURÍDICO / ADVOCACIA', 7200.00, 'Direito Fiscal'),
(NULL, 'Impugnação Judicial', 'Honorário mínimo: €1200', 'JURÍDICO / ADVOCACIA', 7200.00, 'Direito Fiscal'),
(NULL, 'Reclamação a Penhora', 'Honorário mínimo: €400', 'JURÍDICO / ADVOCACIA', 2400.00, 'Direito Fiscal'),
(NULL, 'Requerimento para Providências Legais', 'Honorário mínimo: €350', 'JURÍDICO / ADVOCACIA', 2100.00, 'Direito Fiscal'),
(NULL, 'Requerimento de Revisão', 'Honorário mínimo: €300', 'JURÍDICO / ADVOCACIA', 1800.00, 'Direito Fiscal'),
(NULL, 'Reclamação Judicial em sede de Oposição a Execução', 'Honorário mínimo: €500', 'JURÍDICO / ADVOCACIA', 3000.00, 'Direito Fiscal'),
(NULL, 'Ação de Intimação', 'Honorário mínimo: €1200', 'JURÍDICO / ADVOCACIA', 7200.00, 'Direito Fiscal'),
(NULL, 'Oposição à Execução + Impugnação Judicial', 'Honorário mínimo: €1800', 'JURÍDICO / ADVOCACIA', 10800.00, 'Direito Fiscal'),
(NULL, 'Oposição à Execução + Impugnação Judicial + Ação Cautelar', 'Honorário mínimo: €2500', 'JURÍDICO / ADVOCACIA', 15000.00, 'Direito Fiscal'),
(NULL, 'Oposição à Execução + Impugnação Judicial + Ação Cautelar + Ação Administrativa Especial', 'Honorário mínimo: €3600', 'JURÍDICO / ADVOCACIA', 21600.00, 'Direito Fiscal'),
(NULL, 'Reclamação à Penhora + Oposição à Penhora', 'Honorário mínimo: €1500', 'JURÍDICO / ADVOCACIA', 9000.00, 'Direito Fiscal'),
(NULL, 'Reclamação Graciosa', 'Honorário mínimo: €300', 'JURÍDICO / ADVOCACIA', 1800.00, 'Direito Fiscal'),
(NULL, 'Outras Defesas do Contribuinte', 'Valor médio: €300 a €700', 'JURÍDICO / ADVOCACIA', 3000.00, 'Direito Fiscal'),

-- ── TECNOLÓGICO / AI ──
(NULL, 'Desenvolvimento Web', 'Criação de site ou sistema web', 'TECNOLÓGICO / AI', 5000.00, 'Tecnologia'),
(NULL, 'Aplicativo Mobile', 'Desenvolvimento de aplicativo mobile', 'TECNOLÓGICO / AI', 8000.00, 'Tecnologia'),
(NULL, 'Consultoria em IA', 'Consultoria em inteligência artificial', 'TECNOLÓGICO / AI', 3500.00, 'Tecnologia'),
(NULL, 'Automação de Processos', 'Automação de processos empresariais', 'TECNOLÓGICO / AI', 4500.00, 'Tecnologia'),
(NULL, 'Manutenção de Sistema', 'Manutenção corretiva/evolutiva de sistema', 'TECNOLÓGICO / AI', 2000.00, 'Tecnologia'),
(NULL, 'Infraestrutura Cloud', 'Projeto e implantação de infraestrutura cloud', 'TECNOLÓGICO / AI', 6000.00, 'Tecnologia');
