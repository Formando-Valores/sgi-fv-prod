import { supabase } from '../../supabase';
import { listProcessEvents, type Process, type ProcessEvent } from './processes';
import { can, getReportScope, mapToSystemHierarchy } from './permissions';

export type ReportFilters = {
  periodStart?: string;
  periodEnd?: string;
  processStatus?: string;
  processType?: string;
  responsibleUserId?: string;
  actorUserId?: string;
  organizationId?: string;
  eventType?: string;
  textSearch?: string;
  sortOrder?: 'asc' | 'desc';
};

export type ReportPagination = {
  page: number;
  pageSize: number;
};

export type ReportSelectOption = { value: string; label: string };

export type ReportRow = {
  process: Process;
  events: ProcessEvent[];
  latestEvent: ProcessEvent | null;
  eventCount: number;
  responsibleName: string;
  actorName: string;
  organizationName: string;
  payments: Array<{
    id: string;
    amount: number | null;
    currency: string | null;
    paymentStatus: string | null;
    paidAt: string | null;
    createdAt: string | null;
  }>;
  attachments: Array<{
    id: string;
    name: string;
    source: 'event' | 'metadata';
    createdAt: string | null;
  }>;
  financialHighlights: Array<{
    type: string;
    message: string;
    createdAt: string | null;
  }>;
};

export type ReportSummary = {
  total: number;
  byStatus: Array<{ key: string; total: number }>;
  byEventType: Array<{ key: string; total: number }>;
  byActor: Array<{ key: string; total: number }>;
  byOrganization: Array<{ key: string; total: number }>;
  byUser: Array<{ key: string; total: number }>;
};

export type ReportsResult = {
  total: number;
  page: number;
  pageSize: number;
  rows: ReportRow[];
  summary: ReportSummary;
  options: {
    statuses: ReportSelectOption[];
    types: ReportSelectOption[];
    responsibles: ReportSelectOption[];
    actors: ReportSelectOption[];
    organizations: ReportSelectOption[];
    eventTypes: ReportSelectOption[];
  };
  scope: {
    organizationFilterEnabled: boolean;
    limitedByProfile: boolean;
  };
};

type ReportActorScope = {
  actorId: string;
  orgId: string | null;
  canViewAllReports: boolean;
  canViewGlobalOrganizations: boolean;
  restrictToOwnUser: boolean;
  restrictToResponsibleUser: boolean;
};

const toOptions = (map: Map<string, string>): ReportSelectOption[] =>
  Array.from(map.entries())
    .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
    .map(([value, label]) => ({ value, label }));

const toDateTimeStart = (date?: string) => (date ? `${date}T00:00:00.000Z` : null);
const toDateTimeEnd = (date?: string) => (date ? `${date}T23:59:59.999Z` : null);

const resolveReportActorScope = async (): Promise<ReportActorScope | null> => {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user?.id) return null;

  const actorId = authData.user.id;
  const { data: contextData } = await supabase
    .from('v_user_context')
    .select('org_id,org_role,profile_role,role,hierarchy')
    .eq('user_id', actorId)
    .maybeSingle();

  const subject = {
    id: actorId,
    org_id: contextData?.org_id || null,
    org_role: contextData?.org_role || null,
    profile_role: contextData?.profile_role || contextData?.role || null,
    hierarchy: contextData?.hierarchy || null,
  };

  const hierarchy = mapToSystemHierarchy(subject.org_role, {
    profileRole: subject.profile_role,
    hierarchy: subject.hierarchy,
  });
  const scope = getReportScope({ ...subject, hierarchy });

  return {
    actorId,
    orgId: scope.orgId,
    canViewAllReports: can('view_all', 'relatorios', { ...subject, hierarchy }),
    canViewGlobalOrganizations: scope.canViewGlobalOrganizations,
    restrictToOwnUser: scope.restrictToOwnUser,
    restrictToResponsibleUser: scope.restrictToResponsibleUser,
  };
};

export async function listReportActivities(
  filters: ReportFilters,
  pagination: ReportPagination,
  scope: { defaultOrgId?: string | null; operationalOnly?: boolean } = {},
): Promise<ReportsResult> {
  const actorScope = await resolveReportActorScope();
  if (!actorScope) {
    return {
      total: 0,
      page: pagination.page,
      pageSize: pagination.pageSize,
      rows: [],
      summary: { total: 0, byStatus: [], byEventType: [], byActor: [], byOrganization: [], byUser: [] },
      options: { statuses: [], types: [], responsibles: [], actors: [], organizations: [], eventTypes: [] },
      scope: { organizationFilterEnabled: false, limitedByProfile: true },
    };
  }

  const requestedOrgId = filters.organizationId && filters.organizationId !== 'all' ? filters.organizationId : null;
  const scopedOrganizationId = actorScope.canViewGlobalOrganizations
    ? requestedOrgId || scope.defaultOrgId || actorScope.orgId || null
    : actorScope.orgId || scope.defaultOrgId || null;

  const actorFilter = filters.actorUserId && filters.actorUserId !== 'all' ? filters.actorUserId : null;
  const effectiveActorFilter = actorScope.restrictToOwnUser ? actorScope.actorId : actorFilter;
  const effectiveStatus = filters.processStatus && filters.processStatus !== 'all' ? filters.processStatus : null;
  const effectiveEventType = filters.eventType && filters.eventType !== 'all' ? filters.eventType : null;

  const baseParams = {
    p_org_id: scopedOrganizationId,
    p_actor_user_id: effectiveActorFilter,
    p_process_status: effectiveStatus,
    p_event_type: effectiveEventType,
    p_date_from: toDateTimeStart(filters.periodStart),
    p_date_to: toDateTimeEnd(filters.periodEnd),
    p_search: filters.textSearch?.trim() || null,
  };

  const offset = Math.max(0, (pagination.page - 1) * pagination.pageSize);
  const { data: activityRows, error: activityError } = await supabase.rpc('report_process_activity', {
    ...baseParams,
    p_limit: pagination.pageSize,
    p_offset: offset,
    p_sort_order: filters.sortOrder || 'desc',
  });

  if (activityError) throw activityError;

  const { data: summaryPayload, error: summaryError } = await supabase.rpc('report_process_activity_stats', baseParams);
  if (summaryError) throw summaryError;

  const rows = (activityRows || []) as any[];
  const processIds = rows.map((entry) => entry.process_id).filter(Boolean);
  const processesById = new Map<string, any>();
  if (processIds.length) {
    const { data: processData } = await supabase
      .from('processes')
      .select('id,amount,currency,payment_status,paid_at,process_status')
      .in('id', processIds);
    (processData || []).forEach((item: any) => processesById.set(item.id, item));
  }

  const paymentsByProcessId = new Map<string, any[]>();
  if (processIds.length) {
    const { data: paymentData } = await supabase
      .from('payments')
      .select('id,process_id,amount,currency,payment_status,paid_at,created_at')
      .in('process_id', processIds)
      .order('created_at', { ascending: false });
    (paymentData || []).forEach((item: any) => {
      const current = paymentsByProcessId.get(item.process_id) || [];
      current.push(item);
      paymentsByProcessId.set(item.process_id, current);
    });
  }

  const enrichedRows = await Promise.all(
    rows.map(async (entry) => {
      const events = await listProcessEvents(entry.org_id, entry.process_id);
      const processFinancial = processesById.get(entry.process_id);
      const payments = paymentsByProcessId.get(entry.process_id) || [];
      const attachments = events
        .filter((event) => event.tipo === 'documento' || event.event_type === 'document_attached')
        .map((event) => {
          const metadata = (event.metadata || {}) as Record<string, unknown>;
          const name = String(metadata.file_name || metadata.name || metadata.filename || event.mensagem || 'Anexo');
          return {
            id: event.id,
            name,
            source: metadata.file_name || metadata.name || metadata.filename ? 'metadata' : 'event',
            createdAt: event.created_at || null,
          };
        });
      const financialHighlights = events
        .filter((event) => {
          const eventType = String(event.event_type || '').toLowerCase();
          return eventType.includes('payment') || eventType.includes('finance') || eventType.includes('refund');
        })
        .map((event) => ({
          type: event.event_type || event.tipo,
          message: event.mensagem || 'Evento financeiro',
          createdAt: event.created_at || null,
        }));

      if (processFinancial?.payment_status || processFinancial?.paid_at) {
        financialHighlights.unshift({
          type: 'process_payment_state',
          message: `Status do pagamento: ${processFinancial.payment_status || 'não informado'}${
            processFinancial.paid_at ? ` (pago em ${new Date(processFinancial.paid_at).toLocaleString('pt-BR')})` : ''
          }`,
          createdAt: processFinancial.paid_at || null,
        });
      }

      const process: Process = {
        id: entry.process_id,
        org_id: entry.org_id,
        protocolo: entry.protocol,
        titulo: entry.title,
        cliente_nome: entry.client_name,
        status: entry.process_status,
        unidade_atendimento: entry.process_type,
        payment_status: processFinancial?.payment_status || null,
        process_status: processFinancial?.process_status || entry.process_status,
        responsavel_user_id: entry.responsible_user_id,
        created_at: entry.process_created_at,
        updated_at: entry.process_created_at,
        cliente_documento: null,
        cliente_contato: null,
      };

      const latestEvent: ProcessEvent | null = entry.latest_event_id
        ? {
            id: entry.latest_event_id,
            org_id: entry.org_id,
            process_id: entry.process_id,
            actor_user_id: entry.actor_user_id,
            event_type: entry.latest_event_type,
            tipo: 'observacao',
            mensagem: entry.latest_event_message || '',
            created_by: entry.actor_user_id,
            created_at: entry.latest_event_at,
          }
        : null;

      return {
        process,
        events,
        latestEvent,
        eventCount: Number(entry.event_count || 0),
        responsibleName: entry.responsible_name || 'Não atribuído',
        actorName: entry.actor_name || 'Sistema',
        organizationName: entry.organization_name || entry.org_id,
        payments: payments.map((payment) => ({
          id: payment.id,
          amount: typeof payment.amount === 'number' ? payment.amount : payment.amount ? Number(payment.amount) : null,
          currency: payment.currency || processFinancial?.currency || 'BRL',
          paymentStatus: payment.payment_status || null,
          paidAt: payment.paid_at || null,
          createdAt: payment.created_at || null,
        })),
        attachments,
        financialHighlights,
      } as ReportRow;
    }),
  );

  const statuses = new Map<string, string>();
  const types = new Map<string, string>();
  const responsibles = new Map<string, string>();
  const actors = new Map<string, string>();
  const organizations = new Map<string, string>();
  const eventTypes = new Map<string, string>();

  enrichedRows.forEach((row) => {
    statuses.set(row.process.process_status || row.process.status || 'sem_status', row.process.process_status || row.process.status || 'sem_status');
    types.set(row.process.unidade_atendimento || 'Não informado', row.process.unidade_atendimento || 'Não informado');
    if (row.process.responsavel_user_id) responsibles.set(row.process.responsavel_user_id, row.responsibleName);
    if (row.latestEvent?.created_by) actors.set(row.latestEvent.created_by, row.actorName);
    organizations.set(row.process.org_id, row.organizationName);
    if (row.latestEvent?.event_type) eventTypes.set(row.latestEvent.event_type, row.latestEvent.event_type);
  });

  const summary = (summaryPayload || {
    total: 0,
    byStatus: [],
    byEventType: [],
    byActor: [],
    byOrganization: [],
    byUser: [],
  }) as ReportSummary;

  return {
    total: summary.total || 0,
    page: pagination.page,
    pageSize: pagination.pageSize,
    rows: enrichedRows,
    summary,
    options: {
      statuses: toOptions(statuses),
      types: toOptions(types),
      responsibles: toOptions(responsibles),
      actors: toOptions(actors),
      organizations: toOptions(organizations),
      eventTypes: toOptions(eventTypes),
    },
    scope: {
      organizationFilterEnabled: actorScope.canViewGlobalOrganizations,
      limitedByProfile: actorScope.restrictToOwnUser || actorScope.restrictToResponsibleUser || !actorScope.canViewGlobalOrganizations || !actorScope.canViewAllReports,
    },
  };
}

export const listProcessReports = listReportActivities;
