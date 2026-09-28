import type { User } from '../../types';

/**
 * Linha de processo apresentada nos painéis de administração.
 *
 * Esta interface estava duplicada em três ficheiros
 * (DashboardSection, ProcessesSection e SelectedUserDetailModal) e as cópias
 * divergiram: a de SelectedUserDetailModal perdeu o campo `destination` em
 * `associationFees`, o que impedia passar as mesmas linhas entre componentes.
 *
 * É construída em pages/AdminDashboard.tsx (baseProcessRows) a partir de
 * `Process`. Os campos crus da BD não são reexpostos: `cliente_nome` é mapeado
 * para `name`, `cliente_contato` para `phone`/`email` e `titulo` para
 * `contractedServiceName`.
 */
export interface AdminProcessRow extends User {
  processRecordId?: string;
  profileUserId?: string | null;
  processType: string;
  startDate: string;
  deadlineDate: string;
  etapaAtual: string;
  financeiro: string;
  prioridade: string;
  valor: number;
  sourceLabel: string;
  requestedOrganizationName: string;
  contractedServiceName: string;
  paymentStatus?: string | null;
  osValue?: number | null;
  servicesSelected?: { id: string; name: string; price: number; group: string }[] | null;
  associationFees?: { type: string; name: string; price: number; destination: string }[] | null;
}
