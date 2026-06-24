import type { ServiceUnit } from '../../types';

export type CatalogService = {
  id: string;
  name: string;
  description: string;
  unit: ServiceUnit;
  price: number;
};

export const CUSTOM_ANALYSIS_FEE = 280;

export const SERVICE_CATALOG: CatalogService[] = [
  { id: 'admin-1', name: 'Registro de Empresa', description: 'Registro e abertura de empresa junto à junta comercial', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 2500 },
  { id: 'admin-2', name: 'Alteração Contratual', description: 'Alteração de contrato social', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 1800 },
  { id: 'admin-3', name: 'Certidão Negativa', description: 'Emissão de certidão negativa de débitos', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 500 },
  { id: 'admin-4', name: 'Abertura de Filial', description: 'Registro e abertura de filial', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 3000 },
  { id: 'admin-5', name: 'Assessoria Administrativa Mensal', description: 'Assessoria administrativa recorrente', unit: 'ADMINISTRATIVO' as ServiceUnit, price: 800 },
  { id: 'jur-1', name: 'Consultoria Jurídica', description: 'Consultoria jurídica especializada', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 1200 },
  { id: 'jur-2', name: 'Análise/Elaboração de Contrato', description: 'Análise ou elaboração de contrato', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 2000 },
  { id: 'jur-3', name: 'Ação Judicial', description: 'Ação judicial em qualquer instância', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 5000 },
  { id: 'jur-4', name: 'Defesa Administrativa', description: 'Defesa em processo administrativo', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 3500 },
  { id: 'jur-5', name: 'Parecer Jurídico', description: 'Elaboração de parecer jurídico', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 1500 },
  { id: 'jur-6', name: 'Mediação/Conciliação', description: 'Sessão de mediação ou conciliação', unit: 'JURÍDICO / ADVOCACIA' as ServiceUnit, price: 2200 },
  { id: 'tec-1', name: 'Desenvolvimento Web', description: 'Criação de site ou sistema web', unit: 'TECNOLÓGICO / AI' as ServiceUnit, price: 5000 },
  { id: 'tec-2', name: 'Aplicativo Mobile', description: 'Desenvolvimento de aplicativo mobile', unit: 'TECNOLÓGICO / AI' as ServiceUnit, price: 8000 },
  { id: 'tec-3', name: 'Consultoria em IA', description: 'Consultoria em inteligência artificial', unit: 'TECNOLÓGICO / AI' as ServiceUnit, price: 3500 },
  { id: 'tec-4', name: 'Automação de Processos', description: 'Automação de processos empresariais', unit: 'TECNOLÓGICO / AI' as ServiceUnit, price: 4500 },
  { id: 'tec-5', name: 'Manutenção de Sistema', description: 'Manutenção corretiva/evolutiva de sistema', unit: 'TECNOLÓGICO / AI' as ServiceUnit, price: 2000 },
  { id: 'tec-6', name: 'Infraestrutura Cloud', description: 'Projeto e implantação de infraestrutura cloud', unit: 'TECNOLÓGICO / AI' as ServiceUnit, price: 6000 },
];

export function getServicesByUnit(unit: ServiceUnit): CatalogService[] {
  return SERVICE_CATALOG.filter((s) => s.unit === unit);
}
