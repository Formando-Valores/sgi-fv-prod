/**
 * SGI FV - Processes API Module
 * Database operations for processes and events
 * 
 * DEBUG VERSION: Comprehensive logging enabled
 */

import { supabase } from '../../supabase';
import { getAuthorizationDeniedMessage, getProcessScope } from './permissions';
import { SUPABASE_EDGE_FUNCTIONS } from './supabaseFunctions';

// Debug mode flag
const DEBUG = true;
const log = (...args: any[]) => {
  if (DEBUG) console.log('[Processes API]', new Date().toISOString(), ...args);
};
const logError = (...args: any[]) => {
  console.error('[Processes API ERROR]', new Date().toISOString(), ...args);
};

async function getAuthenticatedUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    logError('Unable to resolve authenticated user from Supabase auth context:', error);
    throw buildManagementDeniedError('processos');
  }
  return data.user?.id ?? null;
}

type ProcessQueryScope = {
  actorUserId: string | null;
  actorProfileRole: string | null;
  actorOrgRole: string | null;
  isGlobalAdmin: boolean;
  resolvedOrgId: string | null;
};



type ProcessScopedFilter = {
  orgId?: string | null;
  userId?: string | null;
  hierarchy?: string | null;
};

function applyScopedProcessFilters<T extends { eq: (...args: any[]) => T }>(query: T, scope: ProcessScopedFilter): T {
  const scopeResolver = getProcessScope({
    org_id: scope.orgId || null,
    id: scope.userId || null,
    hierarchy: scope.hierarchy || null,
  });

  let scopedQuery = query;
  if (scopeResolver.orgId) {
    scopedQuery = scopedQuery.eq('org_id', scopeResolver.orgId);
  }
  if (scopeResolver.restrictToOwnUser && scopeResolver.userId) {
    scopedQuery = scopedQuery.eq('responsavel_user_id', scopeResolver.userId);
  }
  return scopedQuery;
}


function buildManagementDeniedError(scope: 'processos' | 'financeiro' | 'relatorios' = 'processos'): Error {
  return new Error(getAuthorizationDeniedMessage('manage', scope));
}

function buildAreaDeniedError(): Error {
  return new Error('Ação bloqueada: este processo está fora da sua área de atuação (perfil/vínculo). Solicite acesso à área responsável.');
}
const GLOBAL_ADMIN_ROLE_VALUES = new Set([
  'admin',
  'administrator',
  'administrador',
  'administrador geral',
  'owner',
]);

async function resolveProcessQueryScope(
  orgId: string | null | undefined,
  moduleName: string,
): Promise<ProcessQueryScope | null> {
  const actorUserId = await getAuthenticatedUserId();
  if (!actorUserId) {
    logError(`[${moduleName}] blocked: missing authenticated actor.`);
    return null;
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', actorUserId)
    .maybeSingle();

  if (profileError) {
    logError(`[${moduleName}] failed to resolve profile role:`, profileError);
  }

  const normalizedProfileRole = String(profileData?.role || '').trim().toLowerCase();
  const isGlobalAdmin = GLOBAL_ADMIN_ROLE_VALUES.has(normalizedProfileRole);
  const normalizedOrgId = orgId ? String(orgId).trim() : '';
  const resolvedOrgId = normalizedOrgId || null;

  if (!isGlobalAdmin && !resolvedOrgId) {
    logError(`[${moduleName}] blocked: org_id is mandatory for non-global profile.`, {
      actorUserId,
      actorProfileRole: normalizedProfileRole || null,
      orgId,
    });
    return null;
  }

  const { data: membershipData, error: membershipError } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', actorUserId)
    .eq('org_id', resolvedOrgId || '')
    .maybeSingle();

  if (membershipError && resolvedOrgId) {
    logError(`[${moduleName}] failed to resolve org membership role:`, membershipError);
  }

  return {
    actorUserId,
    actorProfileRole: normalizedProfileRole || null,
    actorOrgRole: membershipData?.role ? String(membershipData.role) : null,
    isGlobalAdmin,
    resolvedOrgId,
  };
}

async function logFinancialAuditEvent(
  eventCode: string,
  details: Record<string, unknown>,
): Promise<void> {
  const actorUserId = await getAuthenticatedUserId();
  if (!actorUserId) return;

  const { error } = await supabase
    .from('financial_audit_events')
    .insert({
      actor_user_id: actorUserId,
      event_code: eventCode,
      details,
    });

  if (error) {
    logError('Failed to persist financial audit event:', eventCode, error);
  }
}

async function logAreaScopeDeniedAttempt(
  action: string,
  context: Record<string, unknown>,
): Promise<void> {
  await logFinancialAuditEvent('area_scope_denied_attempt', {
    module: 'processos',
    action,
    ...context,
  });
}

async function assertProcessAreaAccess(
  requestedOrgId: string,
  processId: string,
  action: string,
): Promise<void> {
  const actorUserId = await getAuthenticatedUserId();
  const normalizedRequestedOrgId = String(requestedOrgId || '').trim();
  if (!actorUserId || !normalizedRequestedOrgId) {
    await logAreaScopeDeniedAttempt(action, { requestedOrgId, processId, reason: 'missing_scope_or_actor' });
    throw buildAreaDeniedError();
  }

  const { data: membership, error: membershipError } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', actorUserId)
    .eq('org_id', normalizedRequestedOrgId)
    .maybeSingle();

  if (membershipError || !membership?.org_id) {
    await logAreaScopeDeniedAttempt(action, { requestedOrgId: normalizedRequestedOrgId, processId, reason: 'missing_membership' });
    throw buildAreaDeniedError();
  }

  const { data: targetProcess } = await supabase
    .from('processes')
    .select('org_id')
    .eq('id', processId)
    .maybeSingle();

  if (targetProcess?.org_id && targetProcess.org_id !== normalizedRequestedOrgId) {
    await logAreaScopeDeniedAttempt(action, {
      requestedOrgId: normalizedRequestedOrgId,
      processId,
      processOrgId: targetProcess.org_id,
      reason: 'process_org_mismatch',
    });
    throw buildAreaDeniedError();
  }
}

async function assertOrganizationAreaAccess(
  requestedOrgId: string,
  action: string,
): Promise<void> {
  const actorUserId = await getAuthenticatedUserId();
  const normalizedRequestedOrgId = String(requestedOrgId || '').trim();
  if (!actorUserId || !normalizedRequestedOrgId) {
    await logAreaScopeDeniedAttempt(action, { requestedOrgId, reason: 'missing_scope_or_actor' });
    throw buildAreaDeniedError();
  }

  const { data: membership, error: membershipError } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', actorUserId)
    .eq('org_id', normalizedRequestedOrgId)
    .maybeSingle();

  if (membershipError || !membership?.org_id) {
    await logAreaScopeDeniedAttempt(action, { requestedOrgId: normalizedRequestedOrgId, reason: 'missing_membership' });
    throw buildAreaDeniedError();
  }
}

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
  data_prazo?: string | null;
  usage_deadline_at?: string | null;
  gestor_servico?: string | null;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
  origem_canal?: string | null;
  unidade_atendimento?: string | null;
  org_nome_solicitado?: string | null;
  payment_status?: 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled' | 'released' | null;
  process_status?:
    | 'draft'
    | 'created'
    | 'pending_payment'
    | 'queued'
    | 'in_progress'
    | 'awaiting_documents'
    | 'under_review'
    | 'completed'
    | 'cadastro'
    | 'triagem'
    | 'analise'
    | 'concluido'
    | null;
}

export interface ProcessEvent {
  id: string;
  org_id: string;
  process_id: string;
  actor_user_id?: string | null;
  event_type?: string | null;
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  metadata?: Record<string, unknown> | null;
  tipo: 'registro' | 'status_change' | 'observacao' | 'documento' | 'atribuicao';
  mensagem: string;
  created_by: string | null;
  created_at: string;
}

export type DocumentValidationStatus = 'pending' | 'approved' | 'rejected' | 'resubmission_requested';
export interface ProcessDocumentChecklistItem {
  id: string;
  org_id: string;
  service_id: string;
  document_name: string;
  description?: string | null;
  is_required: boolean;
  sort_order: number;
  active: boolean;
}

export interface ProcessDocumentAttachment {
  id: string;
  org_id: string;
  process_id: string;
  checklist_id?: string | null;
  document_name: string;
  file_path: string;
  file_type?: string | null;
  validation_status: DocumentValidationStatus;
  pending_reason?: string | null;
  review_notes?: string | null;
  guidance?: string | null;
  created_at: string;
}

type ProcessAuditInsert = {
  org_id: string;
  process_id: string;
  actor_user_id: string;
  event_type: string;
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  metadata?: Record<string, unknown>;
  mensagem: string;
  tipo?: ProcessEvent['tipo'];
};

function normalizeAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

async function insertProcessAuditEvents(events: ProcessAuditInsert[]): Promise<void> {
  if (!events.length) return;

  const payload = events.map((event) => ({
    org_id: event.org_id,
    process_id: event.process_id,
    actor_user_id: event.actor_user_id,
    event_type: event.event_type,
    field: event.field || null,
    old_value: event.old_value || null,
    new_value: event.new_value || null,
    metadata: event.metadata || {},
    created_at: new Date().toISOString(),
    tipo: event.tipo || (event.event_type === 'status_changed' ? 'status_change' : 'observacao'),
    mensagem: event.mensagem,
    created_by: event.actor_user_id,
  }));

  const { error } = await supabase.from('process_events').insert(payload);
  if (error) {
    logError('Failed to insert structured process audit events:', error, payload);
  }
}

export interface ClientProcessFinance {
  processId: string;
  serviceName: string;
  amount: number | null;
  currency: string;
  paymentStatus: NonNullable<Process['payment_status']>;
  paidAt: string | null;
  useUntil: string | null;
  usageDeadlineAt: string | null;
  daysRemaining: number | null;
  isExpired: boolean;
  processStatus: NonNullable<Process['process_status']> | null;
}

export interface CreateProcessPayload {
  titulo: string;
  cliente_nome?: string;
  cliente_documento?: string;
  cliente_contato?: string;
  responsavel_user_id?: string;
  cliente_user_id?: string;
  origem_canal?: string;
  unidade_atendimento?: string;
  org_nome_solicitado?: string;
  os_value?: number;
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
    const scope = await resolveProcessQueryScope(org_id, 'processes.list');
    if (!scope) return [];

    log('Executing query on processes table...');
    let query = supabase
      .from('processes')
      .select('*')
      .order('created_at', { ascending: false });
    if (scope.resolvedOrgId) {
      query = query.eq('org_id', scope.resolvedOrgId);
    }
    const { data, error } = await query;

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
    
    await logFinancialAuditEvent('module_query_scope_applied', {
      module: 'processes',
      query: 'listProcesses',
      actorProfileRole: scope.actorProfileRole,
      actorOrgRole: scope.actorOrgRole,
      orgId: scope.resolvedOrgId,
      orgFilterApplied: Boolean(scope.resolvedOrgId),
      isGlobalAdmin: scope.isGlobalAdmin,
      resultCount: data?.length || 0,
    });

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
 * List operational processes for admin panel
 * - payment_status = paid
 * - process_status = liberado
 */
export async function listAdminOperationalProcesses(org_id?: string | null): Promise<Process[]> {
  const startTime = performance.now();
  log('listAdminOperationalProcesses() starting for org_id:', org_id);

  try {
    const scope = await resolveProcessQueryScope(org_id, 'processes.listAdminOperational');
    if (!scope) return [];

    let query = supabase
      .from('processes')
      .select('*')
      .eq('payment_status', 'paid')
      .eq('process_status', 'liberado')
      .order('created_at', { ascending: false });
    if (scope.resolvedOrgId) {
      query = query.eq('org_id', scope.resolvedOrgId);
    }
    const { data, error } = await query;

    const elapsed = performance.now() - startTime;
    log(`Admin operational query completed in ${elapsed.toFixed(2)}ms`);

    if (error) {
      logError('Error listing admin operational processes:', error);
      logError('Error details:', JSON.stringify(error, null, 2));
      return [];
    }

    await logFinancialAuditEvent('admin_financial_processes_viewed', {
      orgId: scope.resolvedOrgId,
      actorUserId: scope.actorUserId,
      actorProfileRole: scope.actorProfileRole,
      actorOrgRole: scope.actorOrgRole,
      module: 'dashboard_unificado',
      resultCount: data?.length || 0,
      orgFilterApplied: Boolean(scope.resolvedOrgId),
      isGlobalAdmin: scope.isGlobalAdmin,
      constraints: {
        payment_status: 'paid',
        process_status: 'liberado',
      },
    });

    log('Admin operational query successful, returned', data?.length || 0, 'processes');
    return data || [];
  } catch (err) {
    const elapsed = performance.now() - startTime;
    logError(`Unexpected error in listAdminOperationalProcesses after ${elapsed.toFixed(2)}ms:`, err);
    logError('Error stack:', (err as Error)?.stack);
    return [];
  }
}

/**
 * List paid processes with financial data for an authenticated client in a specific organization.
 */
export async function listClientPaidProcessesFinance(
  org_id: string,
  client_user_id: string,
): Promise<ClientProcessFinance[]> {
  const startTime = performance.now();
  log('listClientPaidProcessesFinance() starting for org_id:', org_id, 'client_user_id:', client_user_id);

  try {
    const authenticatedUserId = await getAuthenticatedUserId();
    if (!authenticatedUserId) {
      logError('listClientPaidProcessesFinance() blocked: no authenticated user found.');
      return [];
    }
    if (authenticatedUserId !== client_user_id) {
      logError(
        'listClientPaidProcessesFinance() blocked: client_user_id differs from authenticated user.',
        { authenticatedUserId, client_user_id, org_id },
      );
      return [];
    }

    const now = new Date();
    let query = supabase
      .from('processes')
      .select('id,titulo,amount,currency,payment_status,paid_at,data_prazo,usage_deadline_at,process_status')
      .in('payment_status', ['paid', 'released'])
      .order('created_at', { ascending: false });

    query = applyScopedProcessFilters(query, {
      orgId: org_id,
      userId: client_user_id,
      hierarchy: 'cliente',
    });

    const { data, error } = await query;

    const elapsed = performance.now() - startTime;
    log(`Client paid financial query completed in ${elapsed.toFixed(2)}ms`);

    if (error) {
      logError('Error listing client paid financial processes:', error);
      logError('Error details:', JSON.stringify(error, null, 2));
      return [];
    }

    const rows = (data || []).map((row) => {
      const deadline = row.usage_deadline_at
        ? new Date(row.usage_deadline_at)
        : row.data_prazo
          ? new Date(`${row.data_prazo}T23:59:59`)
          : null;
      const daysRemaining = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
      const isExpired = Boolean(deadline && deadline < now);

      return {
        processId: row.id,
        serviceName: row.titulo || 'Serviço não informado',
        amount: typeof row.amount === 'number' ? row.amount : row.amount ? Number(row.amount) : null,
        currency: (row.currency || 'EUR').toUpperCase(),
        paymentStatus: (row.payment_status || 'pending') as NonNullable<Process['payment_status']>,
        paidAt: row.paid_at as string,
        useUntil: row.data_prazo || (deadline ? deadline.toISOString() : null),
        usageDeadlineAt: deadline ? deadline.toISOString() : null,
        daysRemaining,
        isExpired,
        processStatus: (row.process_status || null) as NonNullable<Process['process_status']> | null,
      } satisfies ClientProcessFinance;
    });

    await logFinancialAuditEvent('client_financial_processes_viewed', {
      orgId: org_id,
      actorUserId: authenticatedUserId,
      clientUserId: client_user_id,
      resultCount: rows.length,
      constraints: {
        responsavel_user_id: client_user_id,
        payment_status_in: ['paid', 'released'],
      },
    });

    log('Client paid financial query successful, returned', rows.length, 'processes');
    return rows;
  } catch (err) {
    const elapsed = performance.now() - startTime;
    logError(`Unexpected error in listClientPaidProcessesFinance after ${elapsed.toFixed(2)}ms:`, err);
    logError('Error stack:', (err as Error)?.stack);
    return [];
  }
}



export async function listClientDashboardProcesses(org_id: string, client_user_id: string): Promise<Process[]> {
  const startTime = performance.now();
  log('listClientDashboardProcesses() starting for org_id:', org_id, 'client_user_id:', client_user_id);

  try {
    const authenticatedUserId = await getAuthenticatedUserId();
    if (!authenticatedUserId || authenticatedUserId !== client_user_id) {
      logError('listClientDashboardProcesses() blocked: invalid authenticated client context.', {
        authenticatedUserId,
        client_user_id,
      });
      return [];
    }

    let query = supabase
      .from('processes')
      .select('*')
      .order('created_at', { ascending: false });

    query = applyScopedProcessFilters(query, {
      orgId: org_id,
      userId: client_user_id,
      hierarchy: 'cliente',
    });

    const { data, error } = await query;
    const elapsed = performance.now() - startTime;
    log(`Client dashboard query completed in ${elapsed.toFixed(2)}ms`);

    if (error) {
      logError('Error listing client dashboard processes:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    const elapsed = performance.now() - startTime;
    logError(`Unexpected error in listClientDashboardProcesses after ${elapsed.toFixed(2)}ms:`, err);
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
  await assertOrganizationAreaAccess(org_id, 'create_process');
  
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
      responsavel_user_id: payload.responsavel_user_id || null,
      cliente_user_id: payload.cliente_user_id || null,
      os_value: typeof payload.os_value === 'number' ? payload.os_value : null
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

  log('Creating initial structured audit event...');
  const eventStartTime = performance.now();
  await insertProcessAuditEvents([
    {
      org_id,
      process_id: process.id,
      actor_user_id: created_by,
      event_type: 'process_created',
      field: null,
      old_value: null,
      new_value: normalizeAuditValue({
        titulo: process.titulo,
        status: process.status,
      }),
      metadata: {
        source: 'createProcess',
        protocolo: process.protocolo,
      },
      mensagem: `Processo "${payload.titulo}" criado com sucesso`,
      tipo: 'registro',
    },
  ]);
  
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

  await assertProcessAreaAccess(org_id, process_id, 'update_status');

  const { data: existing } = await supabase
    .from('processes')
    .select('status')
    .eq('org_id', org_id)
    .eq('id', process_id)
    .maybeSingle();

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

  log('Creating status change audit event...');
  await insertProcessAuditEvents([
    {
      org_id,
      process_id,
      actor_user_id: created_by,
      event_type: 'status_changed',
      field: 'status',
      old_value: normalizeAuditValue(existing?.status),
      new_value: normalizeAuditValue(status),
      metadata: {
        source: 'updateProcessStatus',
        status_label: statusLabels[status],
      },
      mensagem: `Status alterado para: ${statusLabels[status]}`,
      tipo: 'status_change',
    },
  ]);

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
  
  const eventType =
    tipo === 'observacao' ? 'note_added' :
    tipo === 'documento' ? 'document_attached' :
    tipo === 'atribuicao' ? 'assignee_changed' :
    tipo === 'status_change' ? 'status_changed' :
    'event_logged';

  await assertProcessAreaAccess(org_id, process_id, 'add_event');

  const { data, error } = await supabase
    .from('process_events')
    .insert({
      org_id,
      process_id,
      actor_user_id: created_by,
      event_type: eventType,
      field: null,
      old_value: null,
      new_value: normalizeAuditValue(mensagem),
      metadata: { source: 'addProcessEvent', tipo },
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
  updates: Partial<Pick<Process, 'titulo' | 'cliente_nome' | 'cliente_documento' | 'cliente_contato' | 'responsavel_user_id' | 'data_prazo' | 'gestor_servico' | 'observacoes'>>,
  actor_user_id?: string,
): Promise<Process> {
  const startTime = performance.now();
  log('updateProcess() starting');
  log('org_id:', org_id, 'process_id:', process_id);
  log('updates:', JSON.stringify(updates, null, 2));

  await assertProcessAreaAccess(org_id, process_id, 'update_fields');
  
  const { data: currentProcess } = await supabase
    .from('processes')
    .select('titulo,cliente_nome,cliente_documento,cliente_contato,responsavel_user_id,data_prazo,gestor_servico,observacoes')
    .eq('org_id', org_id)
    .eq('id', process_id)
    .maybeSingle();

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

  const actorUserId = actor_user_id || (await getAuthenticatedUserId());
  if (actorUserId && currentProcess) {
    const changedEvents: ProcessAuditInsert[] = [];
    Object.entries(updates).forEach(([field, newRawValue]) => {
      const oldRawValue = (currentProcess as Record<string, unknown>)[field];
      const oldValue = normalizeAuditValue(oldRawValue);
      const newValue = normalizeAuditValue(newRawValue);
      if (oldValue === newValue) return;

      changedEvents.push({
        org_id,
        process_id,
        actor_user_id: actorUserId,
        event_type: 'field_updated',
        field,
        old_value: oldValue,
        new_value: newValue,
        metadata: {
          source: 'updateProcess',
        },
        mensagem: `Campo "${field}" alterado`,
        tipo: field === 'responsavel_user_id' ? 'atribuicao' : 'observacao',
      });
    });

    await insertProcessAuditEvents(changedEvents);
  }

  return data;
}

/**
 * Delete a process
 */
export async function deleteProcess(org_id: string, process_id: string, actor_user_id?: string): Promise<void> {
  const startTime = performance.now();
  log('deleteProcess() starting');
  log('org_id:', org_id, 'process_id:', process_id);

  await assertProcessAreaAccess(org_id, process_id, 'delete_process');
  
  const { data: processBeforeDelete } = await supabase
    .from('processes')
    .select('titulo,status')
    .eq('org_id', org_id)
    .eq('id', process_id)
    .maybeSingle();

  const actorUserId = actor_user_id || (await getAuthenticatedUserId());
  if (actorUserId) {
    await insertProcessAuditEvents([
      {
        org_id,
        process_id,
        actor_user_id: actorUserId,
        event_type: 'process_deleted',
        field: null,
        old_value: normalizeAuditValue(processBeforeDelete),
        new_value: null,
        metadata: { source: 'deleteProcess' },
        mensagem: `Processo ${processBeforeDelete?.titulo || process_id} removido`,
        tipo: 'observacao',
      },
    ]);
  }

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

export async function listRequiredChecklistDocuments(org_id: string, service_id: string): Promise<ProcessDocumentChecklistItem[]> {
  const { data, error } = await supabase
    .from('service_order_document_checklists')
    .select('*')
    .eq('org_id', org_id)
    .eq('service_id', service_id)
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function listProcessAttachments(org_id: string, process_id: string): Promise<ProcessDocumentAttachment[]> {
  const { data, error } = await supabase
    .from('process_document_attachments')
    .select('*')
    .eq('org_id', org_id)
    .eq('process_id', process_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addProcessAttachment(
  org_id: string,
  process_id: string,
  payload: Pick<ProcessDocumentAttachment, 'document_name' | 'file_path' | 'file_type' | 'pending_reason'>,
  actor_user_id: string,
): Promise<void> {
  const { error } = await supabase.from('process_document_attachments').insert({
    org_id,
    process_id,
    document_name: payload.document_name,
    file_path: payload.file_path,
    file_type: payload.file_type || null,
    pending_reason: payload.pending_reason || 'Aguardando validação documental',
    uploaded_by: actor_user_id,
  });
  if (error) throw error;

  await insertProcessAuditEvents([
    {
      org_id,
      process_id,
      actor_user_id,
      event_type: 'document_pending',
      mensagem: `Documento anexado com pendência: ${payload.document_name}`,
      tipo: 'documento',
      metadata: { status: 'pending', file_path: payload.file_path },
    },
  ]);

  await supabase.from('processes').update({ process_status: 'awaiting_documents' }).eq('org_id', org_id).eq('id', process_id);
}

export async function reviewProcessAttachment(
  org_id: string,
  process_id: string,
  attachment_id: string,
  decision: 'approved' | 'rejected' | 'resubmission_requested',
  actor_user_id: string,
  options?: { justification?: string; guidance?: string },
): Promise<void> {
  if (decision === 'rejected' && !options?.justification?.trim()) {
    throw new Error('Justificativa é obrigatória para recusa.');
  }
  if (decision === 'resubmission_requested' && !options?.guidance?.trim()) {
    throw new Error('Orientação é obrigatória para solicitar reenvio.');
  }

  const review_notes = decision === 'rejected' ? options?.justification?.trim() : null;
  const guidance = decision === 'resubmission_requested' ? options?.guidance?.trim() : null;

  const { data: processData } = await supabase
    .from('processes')
    .select('id,titulo,cliente_nome,cliente_contato,responsavel_user_id')
    .eq('org_id', org_id)
    .eq('id', process_id)
    .maybeSingle();

  const { error } = await supabase
    .from('process_document_attachments')
    .update({
      validation_status: decision,
      reviewer_user_id: actor_user_id,
      reviewed_at: new Date().toISOString(),
      review_notes,
      guidance,
    })
    .eq('org_id', org_id)
    .eq('process_id', process_id)
    .eq('id', attachment_id);
  if (error) throw error;

  await insertProcessAuditEvents([
    {
      org_id,
      process_id,
      actor_user_id,
      event_type: decision === 'approved' ? 'document_reviewed' : 'document_rejected_resubmission_requested',
      mensagem: `Documento ${decision === 'approved' ? 'aprovado' : decision === 'rejected' ? 'recusado' : 'com reenvio solicitado'}`,
      tipo: 'documento',
      metadata: { attachment_id, decision, review_notes, guidance },
    },
  ]);

  if (decision !== 'approved') {
    await supabase.from('processes').update({ process_status: 'awaiting_documents' }).eq('org_id', org_id).eq('id', process_id);

    const notificationReason = review_notes || guidance || 'Documento recusado durante validação.';

    await insertProcessAuditEvents([
      {
        org_id,
        process_id,
        actor_user_id,
        event_type: 'document_notification_sent',
        mensagem: `Notificação de pendência documental enviada ao cliente (${decision === 'rejected' ? 'recusa' : 'reenvio solicitado'}).`,
        tipo: 'observacao',
        metadata: {
          timestamp: new Date().toISOString(),
          author_user_id: actor_user_id,
          reason: notificationReason,
          decision,
        },
      },
    ]);

    await supabase.functions.invoke(SUPABASE_EDGE_FUNCTIONS.DOCUMENT_REVIEW_NOTIFICATION, {
      body: {
        org_id,
        process_id,
        decision,
        justification: review_notes,
        guidance,
        reason: notificationReason,
        actor_user_id,
        process: processData || null,
      },
    });
  }
}

/**
 * Get process statistics for dashboard
 */
export async function getProcessStats(org_id?: string | null) {
  const startTime = performance.now();
  log('getProcessStats() starting for org_id:', org_id);
  
  const defaultStats = { total: 0, cadastro: 0, triagem: 0, analise: 0, concluido: 0 };
  
  try {
    const scope = await resolveProcessQueryScope(org_id, 'processes.getStats');
    if (!scope) return defaultStats;

    log('Executing query on processes table...');
    let query = supabase
      .from('processes')
      .select('status');
    if (scope.resolvedOrgId) {
      query = query.eq('org_id', scope.resolvedOrgId);
    }
    const { data, error } = await query;

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

    await logFinancialAuditEvent('module_query_scope_applied', {
      module: 'dashboard_unificado',
      query: 'getProcessStats',
      actorProfileRole: scope.actorProfileRole,
      actorOrgRole: scope.actorOrgRole,
      orgId: scope.resolvedOrgId,
      orgFilterApplied: Boolean(scope.resolvedOrgId),
      isGlobalAdmin: scope.isGlobalAdmin,
      resultCount: data?.length || 0,
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
