import type { Process } from './processes';

export const PROCESS_STATUS_BADGES: Record<string, { label: string; color: string }> = {
  cadastro: { label: 'Cadastro', color: 'bg-slate-600' },
  triagem: { label: 'Triagem', color: 'bg-yellow-600' },
  analise: { label: 'Análise', color: 'bg-orange-600' },
  concluido: { label: 'Concluído', color: 'bg-emerald-600' },
  queued: { label: 'Na Fila', color: 'bg-indigo-600' },
  in_progress: { label: 'Em Execução', color: 'bg-blue-600' },
  awaiting_documents: { label: 'Aguardando Docs', color: 'bg-amber-600' },
  under_review: { label: 'Em Revisão', color: 'bg-purple-600' },
  completed: { label: 'Finalizado', color: 'bg-emerald-600' },
  pending_payment: { label: 'Pagamento Pendente', color: 'bg-red-700' },
};

export const PAYMENT_STATUS_BADGES: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-700' },
  paid: { label: 'Pago', color: 'bg-emerald-700' },
  failed: { label: 'Falhou', color: 'bg-red-700' },
  refunded: { label: 'Estornado', color: 'bg-orange-700' },
  canceled: { label: 'Cancelado', color: 'bg-slate-700' },
  released: { label: 'Liberado', color: 'bg-cyan-700' },
};

export const getOperationalStatus = (process: Process) => process.process_status || process.status;

export const getProcessStatusLabel = (status?: string | null) => {
  if (!status) return null;
  return PROCESS_STATUS_BADGES[status]?.label || status;
};

export const getPaymentStatusLabel = (status?: string | null) => {
  if (!status) return null;
  return PAYMENT_STATUS_BADGES[status]?.label || status;
};
