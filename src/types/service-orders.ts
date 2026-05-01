/**
 * SGI FV - Service Orders Types (STUB)
 * 
 * TODO: Implementar schema para ordens de serviço:
 * - Catálogo de serviços
 * - Ordens de serviço por cliente
 * - Status e timeline
 * - Documentos anexos
 * - Checklist obrigatório por serviço/OS
 * - Validação de anexos por equipe (Admin/Pleno/Sênior)
 */

import { ProcessStatus, ServiceUnit } from '../../types';

/**
 * Serviço no catálogo
 * TODO: Criar tabela `services` no Supabase
 */
export interface Service {
  id: string;
  org_id: string;
  name: string;
  description: string;
  unit: ServiceUnit;
  price?: number;
  estimated_days?: number;
  active: boolean;
  created_at: string;
}

/**
 * Ordem de serviço
 * TODO: Criar tabela `service_orders` no Supabase
 */
export interface ServiceOrder {
  id: string;
  org_id: string;
  client_id: string;
  service_id: string;
  protocol: string;
  status: ProcessStatus;
  notes?: string;
  deadline?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Entrada na timeline da ordem
 * TODO: Criar tabela `service_order_timeline` no Supabase
 */
export interface ServiceOrderTimeline {
  id: string;
  order_id: string;
  status: ProcessStatus;
  notes?: string;
  created_by: string;
  created_at: string;
}

/**
 * Documento anexo à ordem
 * TODO: Criar tabela `service_order_documents` no Supabase
 */
export interface ServiceOrderDocument {
  id: string;
  order_id: string;
  name: string;
  file_path: string;
  file_type: string;
  uploaded_by: string;
  created_at: string;
}

/**
 * Checklist de documentos obrigatórios por serviço
 * Tabela: `service_order_document_checklists`
 */
export interface ServiceOrderDocumentChecklist {
  id: string;
  org_id: string;
  service_id: string;
  document_name: string;
  description?: string | null;
  is_required: boolean;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at?: string;
}

export type DocumentValidationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'resubmission_requested';

/**
 * Anexo por processo/OS com trilha de validação
 * Tabela: `process_document_attachments`
 */
export interface ProcessDocumentAttachment {
  id: string;
  org_id: string;
  process_id: string;
  service_order_id?: string | null;
  checklist_id?: string | null;
  document_name: string;
  file_path: string;
  file_type?: string | null;
  uploaded_by: string;
  validation_status: DocumentValidationStatus;
  pending_reason?: string | null;
  reviewer_user_id?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  guidance?: string | null;
  created_at: string;
  updated_at?: string;
}
