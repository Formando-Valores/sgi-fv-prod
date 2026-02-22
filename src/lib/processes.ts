/**
 * SGI FV - Processes API Module
 * Database operations for processes and events
 */

import { supabase } from '../../supabase';

export interface Process {
  id: string;
  org_id: string;
  titulo: string;
  protocolo: string | null;
  status: 'cadastro' | 'triagem' | 'analise' | 'concluido';
  cliente_nome: string | null;
  cliente_documento: string | null;
  cliente_contato: string | null;
  responsavel_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessEvent {
  id: string;
  org_id: string;
  process_id: string;
  tipo: 'registro' | 'status_change' | 'observacao' | 'documento' | 'atribuicao';
  mensagem: string;
  created_by: string | null;
  created_at: string;
}

export interface CreateProcessPayload {
  titulo: string;
  cliente_nome?: string;
  cliente_documento?: string;
  cliente_contato?: string;
  responsavel_user_id?: string;
}

/**
 * List all processes for an organization
 */
export async function listProcesses(org_id: string): Promise<Process[]> {
  const { data, error } = await supabase
    .from('processes')
    .select('*')
    .eq('org_id', org_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing processes:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * Get a single process by ID
 */
export async function getProcessById(org_id: string, id: string): Promise<Process | null> {
  const { data, error } = await supabase
    .from('processes')
    .select('*')
    .eq('org_id', org_id)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error getting process:', error);
    return null;
  }
  
  return data;
}

/**
 * List events for a process
 */
export async function listProcessEvents(org_id: string, process_id: string): Promise<ProcessEvent[]> {
  const { data, error } = await supabase
    .from('process_events')
    .select('*')
    .eq('org_id', org_id)
    .eq('process_id', process_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing process events:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * Create a new process
 */
export async function createProcess(
  org_id: string,
  payload: CreateProcessPayload,
  created_by: string
): Promise<Process> {
  // Create the process
  const { data: process, error: processError } = await supabase
    .from('processes')
    .insert({
      org_id,
      titulo: payload.titulo,
      status: 'cadastro',
      cliente_nome: payload.cliente_nome || null,
      cliente_documento: payload.cliente_documento || null,
      cliente_contato: payload.cliente_contato || null,
      responsavel_user_id: payload.responsavel_user_id || null
    })
    .select()
    .single();

  if (processError || !process) {
    console.error('Error creating process:', processError);
    throw processError;
  }

  // Create the initial event
  await supabase
    .from('process_events')
    .insert({
      org_id,
      process_id: process.id,
      tipo: 'registro',
      mensagem: `Processo "${payload.titulo}" criado com sucesso`,
      created_by
    });

  return process;
}

/**
 * Update process status
 */
export async function updateProcessStatus(
  org_id: string,
  process_id: string,
  status: Process['status'],
  created_by: string
): Promise<Process> {
  const statusLabels: Record<string, string> = {
    cadastro: 'Cadastro',
    triagem: 'Triagem',
    analise: 'Análise',
    concluido: 'Concluído'
  };

  // Update the process
  const { data: process, error: processError } = await supabase
    .from('processes')
    .update({ status })
    .eq('org_id', org_id)
    .eq('id', process_id)
    .select()
    .single();

  if (processError || !process) {
    console.error('Error updating process status:', processError);
    throw processError;
  }

  // Create status change event
  await supabase
    .from('process_events')
    .insert({
      org_id,
      process_id,
      tipo: 'status_change',
      mensagem: `Status alterado para: ${statusLabels[status]}`,
      created_by
    });

  return process;
}

/**
 * Add an observation event to a process
 */
export async function addProcessEvent(
  org_id: string,
  process_id: string,
  tipo: ProcessEvent['tipo'],
  mensagem: string,
  created_by: string
): Promise<ProcessEvent> {
  const { data, error } = await supabase
    .from('process_events')
    .insert({
      org_id,
      process_id,
      tipo,
      mensagem,
      created_by
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Error adding process event:', error);
    throw error;
  }

  return data;
}

/**
 * Update process fields
 */
export async function updateProcess(
  org_id: string,
  process_id: string,
  updates: Partial<Pick<Process, 'titulo' | 'cliente_nome' | 'cliente_documento' | 'cliente_contato' | 'responsavel_user_id'>>
): Promise<Process> {
  const { data, error } = await supabase
    .from('processes')
    .update(updates)
    .eq('org_id', org_id)
    .eq('id', process_id)
    .select()
    .single();

  if (error || !data) {
    console.error('Error updating process:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a process
 */
export async function deleteProcess(org_id: string, process_id: string): Promise<void> {
  const { error } = await supabase
    .from('processes')
    .delete()
    .eq('org_id', org_id)
    .eq('id', process_id);

  if (error) {
    console.error('Error deleting process:', error);
    throw error;
  }
}

/**
 * Get process statistics for dashboard
 */
export async function getProcessStats(org_id: string) {
  const { data, error } = await supabase
    .from('processes')
    .select('status')
    .eq('org_id', org_id);

  if (error) {
    console.error('Error getting process stats:', error);
    return { total: 0, cadastro: 0, triagem: 0, analise: 0, concluido: 0 };
  }

  const stats = {
    total: data?.length || 0,
    cadastro: 0,
    triagem: 0,
    analise: 0,
    concluido: 0
  };

  data?.forEach((p) => {
    if (p.status in stats) {
      stats[p.status as keyof typeof stats]++;
    }
  });

  return stats;
}
