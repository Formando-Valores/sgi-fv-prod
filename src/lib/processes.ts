/**
 * SGI FV - Processes API Module
 * Database operations for processes and events
 * 
 * DEBUG VERSION: Comprehensive logging enabled
 */

import { supabase } from '../../supabase';

// Debug mode flag
const DEBUG = true;
const log = (...args: any[]) => {
  if (DEBUG) console.log('[Processes API]', new Date().toISOString(), ...args);
};
const logError = (...args: any[]) => {
  console.error('[Processes API ERROR]', new Date().toISOString(), ...args);
};

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
 * Check if an error is a "relation does not exist" error
 */
function isTableNotFoundError(error: any): boolean {
  const message = error?.message || error?.details || '';
  return (
    message.includes('relation') && message.includes('does not exist') ||
    message.includes('42P01') || // PostgreSQL error code for undefined_table
    error?.code === '42P01'
  );
}

/**
 * List all processes for an organization
 */
export async function listProcesses(org_id: string): Promise<Process[]> {
  const startTime = performance.now();
  log('listProcesses() starting for org_id:', org_id);
  
  try {
    log('Executing query on processes table...');
    const { data, error } = await supabase
      .from('processes')
      .select('*')
      .eq('org_id', org_id)
      .order('created_at', { ascending: false });

    const elapsed = performance.now() - startTime;
    log(`Query completed in ${elapsed.toFixed(2)}ms`);

    if (error) {
      logError('Error listing processes:', error);
      logError('Error details:', JSON.stringify(error, null, 2));
      logError('Error code:', error.code);
      logError('Error message:', error.message);
      
      if (isTableNotFoundError(error)) {
        log('⚠️ Tabela "processes" não existe. Execute as migrações SQL primeiro.');
      }
      
      return []; // Return empty array instead of throwing
    }
    
    log('Query successful, returned', data?.length || 0, 'processes');
    return data || [];
  } catch (err) {
    const elapsed = performance.now() - startTime;
    logError(`Unexpected error in listProcesses after ${elapsed.toFixed(2)}ms:`, err);
    logError('Error stack:', (err as Error)?.stack);
    return [];
  }
}

/**
 * Get a single process by ID
 */
export async function getProcessById(org_id: string, id: string): Promise<Process | null> {
  const startTime = performance.now();
  log('getProcessById() starting for org_id:', org_id, 'id:', id);
  
  try {
    log('Executing query on processes table...');
    const { data, error } = await supabase
      .from('processes')
      .select('*')
      .eq('org_id', org_id)
      .eq('id', id)
      .single();

    const elapsed = performance.now() - startTime;
    log(`Query completed in ${elapsed.toFixed(2)}ms`);

    if (error) {
      logError('Error getting process:', error);
      logError('Error details:', JSON.stringify(error, null, 2));
      return null;
    }
    
    log('Query successful, found process:', data?.id);
    return data;
  } catch (err) {
    const elapsed = performance.now() - startTime;
    logError(`Unexpected error in getProcessById after ${elapsed.toFixed(2)}ms:`, err);
    logError('Error stack:', (err as Error)?.stack);
    return null;
  }
}

/**
 * List events for a process
 */
export async function listProcessEvents(org_id: string, process_id: string): Promise<ProcessEvent[]> {
  const startTime = performance.now();
  log('listProcessEvents() starting for org_id:', org_id, 'process_id:', process_id);
  
  try {
    log('Executing query on process_events table...');
    const { data, error } = await supabase
      .from('process_events')
      .select('*')
      .eq('org_id', org_id)
      .eq('process_id', process_id)
      .order('created_at', { ascending: false });

    const elapsed = performance.now() - startTime;
    log(`Query completed in ${elapsed.toFixed(2)}ms`);

    if (error) {
      logError('Error listing process events:', error);
      logError('Error details:', JSON.stringify(error, null, 2));
      
      if (isTableNotFoundError(error)) {
        log('⚠️ Tabela "process_events" não existe. Execute as migrações SQL primeiro.');
      }
      
      return [];
    }
    
    log('Query successful, returned', data?.length || 0, 'events');
    return data || [];
  } catch (err) {
    const elapsed = performance.now() - startTime;
    logError(`Unexpected error in listProcessEvents after ${elapsed.toFixed(2)}ms:`, err);
    logError('Error stack:', (err as Error)?.stack);
    return [];
  }
}

/**
 * Create a new process
 */
export async function createProcess(
  org_id: string,
  payload: CreateProcessPayload,
  created_by: string
): Promise<Process> {
  const startTime = performance.now();
  log('createProcess() starting');
  log('org_id:', org_id);
  log('payload:', JSON.stringify(payload, null, 2));
  log('created_by:', created_by);
  
  // Create the process
  log('Inserting process...');
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

  const insertElapsed = performance.now() - startTime;
  log(`Process insert completed in ${insertElapsed.toFixed(2)}ms`);

  if (processError || !process) {
    logError('Error creating process:', processError);
    logError('Error details:', JSON.stringify(processError, null, 2));
    throw processError;
  }

  log('Process created successfully, id:', process.id);

  // Create the initial event
  log('Creating initial event...');
  const eventStartTime = performance.now();
  await supabase
    .from('process_events')
    .insert({
      org_id,
      process_id: process.id,
      tipo: 'registro',
      mensagem: `Processo "${payload.titulo}" criado com sucesso`,
      created_by
    });
  
  const eventElapsed = performance.now() - eventStartTime;
  log(`Event insert completed in ${eventElapsed.toFixed(2)}ms`);

  const totalElapsed = performance.now() - startTime;
  log(`createProcess() completed in ${totalElapsed.toFixed(2)}ms`);

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
  const startTime = performance.now();
  log('updateProcessStatus() starting');
  log('org_id:', org_id, 'process_id:', process_id, 'status:', status);
  
  const statusLabels: Record<string, string> = {
    cadastro: 'Cadastro',
    triagem: 'Triagem',
    analise: 'Análise',
    concluido: 'Concluído'
  };

  // Update the process
  log('Updating process status...');
  const { data: process, error: processError } = await supabase
    .from('processes')
    .update({ status })
    .eq('org_id', org_id)
    .eq('id', process_id)
    .select()
    .single();

  const updateElapsed = performance.now() - startTime;
  log(`Status update completed in ${updateElapsed.toFixed(2)}ms`);

  if (processError || !process) {
    logError('Error updating process status:', processError);
    logError('Error details:', JSON.stringify(processError, null, 2));
    throw processError;
  }

  log('Status updated successfully');

  // Create status change event
  log('Creating status change event...');
  await supabase
    .from('process_events')
    .insert({
      org_id,
      process_id,
      tipo: 'status_change',
      mensagem: `Status alterado para: ${statusLabels[status]}`,
      created_by
    });

  const totalElapsed = performance.now() - startTime;
  log(`updateProcessStatus() completed in ${totalElapsed.toFixed(2)}ms`);

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
  const startTime = performance.now();
  log('addProcessEvent() starting');
  log('org_id:', org_id, 'process_id:', process_id, 'tipo:', tipo);
  
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

  const elapsed = performance.now() - startTime;
  log(`addProcessEvent() completed in ${elapsed.toFixed(2)}ms`);

  if (error || !data) {
    logError('Error adding process event:', error);
    logError('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }

  log('Event added successfully, id:', data.id);
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
  const startTime = performance.now();
  log('updateProcess() starting');
  log('org_id:', org_id, 'process_id:', process_id);
  log('updates:', JSON.stringify(updates, null, 2));
  
  const { data, error } = await supabase
    .from('processes')
    .update(updates)
    .eq('org_id', org_id)
    .eq('id', process_id)
    .select()
    .single();

  const elapsed = performance.now() - startTime;
  log(`updateProcess() completed in ${elapsed.toFixed(2)}ms`);

  if (error || !data) {
    logError('Error updating process:', error);
    logError('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }

  log('Process updated successfully');
  return data;
}

/**
 * Delete a process
 */
export async function deleteProcess(org_id: string, process_id: string): Promise<void> {
  const startTime = performance.now();
  log('deleteProcess() starting');
  log('org_id:', org_id, 'process_id:', process_id);
  
  const { error } = await supabase
    .from('processes')
    .delete()
    .eq('org_id', org_id)
    .eq('id', process_id);

  const elapsed = performance.now() - startTime;
  log(`deleteProcess() completed in ${elapsed.toFixed(2)}ms`);

  if (error) {
    logError('Error deleting process:', error);
    logError('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }

  log('Process deleted successfully');
}

/**
 * Get process statistics for dashboard
 */
export async function getProcessStats(org_id: string) {
  const startTime = performance.now();
  log('getProcessStats() starting for org_id:', org_id);
  
  const defaultStats = { total: 0, cadastro: 0, triagem: 0, analise: 0, concluido: 0 };
  
  try {
    log('Executing query on processes table...');
    const { data, error } = await supabase
      .from('processes')
      .select('status')
      .eq('org_id', org_id);

    const elapsed = performance.now() - startTime;
    log(`Query completed in ${elapsed.toFixed(2)}ms`);

    if (error) {
      logError('Error getting process stats:', error);
      logError('Error details:', JSON.stringify(error, null, 2));
      
      if (isTableNotFoundError(error)) {
        log('⚠️ Tabela "processes" não existe. Execute as migrações SQL primeiro.');
      }
      
      return defaultStats;
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

    log('Stats calculated:', JSON.stringify(stats));
    return stats;
  } catch (err) {
    const elapsed = performance.now() - startTime;
    logError(`Unexpected error in getProcessStats after ${elapsed.toFixed(2)}ms:`, err);
    logError('Error stack:', (err as Error)?.stack);
    return defaultStats;
  }
}
