import { supabase } from '../../supabase';
import {
  listAdminOperationalProcesses,
  listProcessEvents,
  listProcesses,
  type Process,
  type ProcessEvent,
} from './processes';

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
};

const normalize = (value?: string | null) => (value || '').trim().toLowerCase();

const inPeriod = (createdAt: string, periodStart?: string, periodEnd?: string) => {
  const date = new Date(createdAt);
  if (periodStart && date < new Date(`${periodStart}T00:00:00`)) return false;
  if (periodEnd && date > new Date(`${periodEnd}T23:59:59`)) return false;
  return true;
};

const toOptions = (map: Map<string, string>): ReportSelectOption[] =>
  Array.from(map.entries())
    .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
    .map(([value, label]) => ({ value, label }));

export async function listProcessReports(
  filters: ReportFilters,
  pagination: ReportPagination,
  scope: { defaultOrgId?: string | null; operationalOnly?: boolean } = {},
): Promise<ReportsResult> {
  const orgId = filters.organizationId || scope.defaultOrgId || '';
  const processes = scope.operationalOnly
    ? await listAdminOperationalProcesses(orgId || undefined)
    : await listProcesses(orgId);

  const orgIds = Array.from(new Set(processes.map((item) => item.org_id).filter(Boolean)));
  const responsibleIds = Array.from(new Set(processes.map((item) => item.responsavel_user_id).filter(Boolean))) as string[];

  const [profilesResult, organizationsResult] = await Promise.all([
    supabase.from('profiles').select('id,nome_completo,email').in('id', responsibleIds.length ? responsibleIds : ['']),
    supabase.from('organizations').select('id,name').in('id', orgIds.length ? orgIds : ['']),
  ]);

  const profileMap = new Map<string, string>();
  (profilesResult.data || []).forEach((profile) => {
    profileMap.set(profile.id, profile.nome_completo || profile.email || profile.id);
  });

  const orgMap = new Map<string, string>();
  (organizationsResult.data || []).forEach((org) => {
    orgMap.set(org.id, org.name || org.id);
  });

  const eventRows = await Promise.all(
    processes.map(async (process) => {
      const events = await listProcessEvents(process.org_id, process.id);
      return { process, events };
    }),
  );

  const actorIds = Array.from(
    new Set(eventRows.flatMap((entry) => entry.events.map((event) => event.created_by).filter(Boolean))),
  ) as string[];

  if (actorIds.length > 0) {
    const { data } = await supabase.from('profiles').select('id,nome_completo,email').in('id', actorIds);
    (data || []).forEach((profile) => {
      profileMap.set(profile.id, profile.nome_completo || profile.email || profile.id);
    });
  }

  const textSearch = normalize(filters.textSearch);

  const filteredRows: ReportRow[] = eventRows
    .map(({ process, events }) => {
      const latestEvent = events[0] || null;
      const responsibleName = process.responsavel_user_id ? profileMap.get(process.responsavel_user_id) || process.responsavel_user_id : 'Não atribuído';
      const actorName = latestEvent?.created_by ? profileMap.get(latestEvent.created_by) || latestEvent.created_by : 'Sistema';
      const organizationName = orgMap.get(process.org_id) || process.org_id;

      return {
        process,
        events,
        latestEvent,
        eventCount: events.length,
        responsibleName,
        actorName,
        organizationName,
      };
    })
    .filter((row) => {
      const status = row.process.process_status || row.process.status || '';
      const type = row.process.unidade_atendimento || '';

      if (!inPeriod(row.process.created_at, filters.periodStart, filters.periodEnd)) return false;
      if (filters.processStatus && filters.processStatus !== 'all' && normalize(status) !== normalize(filters.processStatus)) return false;
      if (filters.processType && filters.processType !== 'all' && normalize(type) !== normalize(filters.processType)) return false;
      if (filters.responsibleUserId && filters.responsibleUserId !== 'all' && row.process.responsavel_user_id !== filters.responsibleUserId) return false;
      if (filters.organizationId && filters.organizationId !== 'all' && row.process.org_id !== filters.organizationId) return false;
      if (filters.eventType && filters.eventType !== 'all' && !row.events.some((event) => normalize(event.event_type || event.tipo) === normalize(filters.eventType))) return false;
      if (filters.actorUserId && filters.actorUserId !== 'all' && !row.events.some((event) => (event.actor_user_id || event.created_by) === filters.actorUserId)) return false;

      if (!textSearch) return true;

      const textPool = [
        row.process.protocolo || '',
        row.process.titulo || '',
        row.process.cliente_nome || '',
        ...row.events.map((event) => event.mensagem || ''),
      ]
        .join(' ')
        .toLowerCase();

      return textPool.includes(textSearch);
    });

  const summary: ReportSummary = {
    total: filteredRows.length,
    byStatus: [],
    byEventType: [],
    byActor: [],
    byOrganization: [],
    byUser: [],
  };

  const statusCounter = new Map<string, number>();
  const eventTypeCounter = new Map<string, number>();
  const actorCounter = new Map<string, number>();
  const organizationCounter = new Map<string, number>();
  const userCounter = new Map<string, number>();

  filteredRows.forEach((row) => {
    const status = row.process.process_status || row.process.status || 'sem_status';
    statusCounter.set(status, (statusCounter.get(status) || 0) + 1);
    organizationCounter.set(row.organizationName, (organizationCounter.get(row.organizationName) || 0) + 1);

    row.events.forEach((event) => {
      const normalizedEventType = event.event_type || event.tipo;
      eventTypeCounter.set(normalizedEventType, (eventTypeCounter.get(normalizedEventType) || 0) + 1);
      const actorId = event.actor_user_id || event.created_by;
      const actor = actorId ? profileMap.get(actorId) || actorId : 'Sistema';
      actorCounter.set(actor, (actorCounter.get(actor) || 0) + 1);
      userCounter.set(actor, (userCounter.get(actor) || 0) + 1);
    });
  });

  summary.byStatus = Array.from(statusCounter.entries()).map(([key, total]) => ({ key, total }));
  summary.byEventType = Array.from(eventTypeCounter.entries()).map(([key, total]) => ({ key, total }));
  summary.byActor = Array.from(actorCounter.entries()).map(([key, total]) => ({ key, total }));
  summary.byOrganization = Array.from(organizationCounter.entries()).map(([key, total]) => ({ key, total }));
  summary.byUser = Array.from(userCounter.entries()).map(([key, total]) => ({ key, total }));

  const statuses = new Map<string, string>();
  const types = new Map<string, string>();
  const responsibles = new Map<string, string>();
  const actors = new Map<string, string>();
  const organizations = new Map<string, string>();
  const eventTypes = new Map<string, string>();

  eventRows.forEach(({ process, events }) => {
    const status = process.process_status || process.status || 'sem_status';
    statuses.set(status, status);

    const type = process.unidade_atendimento || 'Não informado';
    types.set(type, type);

    if (process.responsavel_user_id) {
      responsibles.set(process.responsavel_user_id, profileMap.get(process.responsavel_user_id) || process.responsavel_user_id);
    }

    organizations.set(process.org_id, orgMap.get(process.org_id) || process.org_id);

    events.forEach((event) => {
      const normalizedEventType = event.event_type || event.tipo;
      eventTypes.set(normalizedEventType, normalizedEventType);
      const actorId = event.actor_user_id || event.created_by;
      if (actorId) {
        actors.set(actorId, profileMap.get(actorId) || actorId);
      }
    });
  });

  const start = Math.max(0, (pagination.page - 1) * pagination.pageSize);
  const end = start + pagination.pageSize;

  return {
    total: filteredRows.length,
    page: pagination.page,
    pageSize: pagination.pageSize,
    rows: filteredRows.slice(start, end),
    summary,
    options: {
      statuses: toOptions(statuses),
      types: toOptions(types),
      responsibles: toOptions(responsibles),
      actors: toOptions(actors),
      organizations: toOptions(organizations),
      eventTypes: toOptions(eventTypes),
    },
  };
}
