/**
 * SGI FV - Service Orders Types (STUB)
 * 
 * TODO: Implementar schema para ordens de serviço:
 * - Catálogo de serviços
 * - Ordens de serviço por cliente
 * - Status e timeline
 * - Documentos anexos
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
