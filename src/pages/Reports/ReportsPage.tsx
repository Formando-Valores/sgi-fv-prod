import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, FileText, Search } from 'lucide-react';
import { listReportActivities, type ReportFilters, type ReportRow } from '../../lib/reports';

interface ReportsPageProps {
  defaultOrgId?: string | null;
  operationalOnly?: boolean;
}

const PAGE_SIZE = 10;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

const ReportsPage: React.FC<ReportsPageProps> = ({ defaultOrgId, operationalOnly }) => {
  const [filters, setFilters] = useState<ReportFilters>({
    processStatus: 'all',
    processType: 'all',
    responsibleUserId: 'all',
    actorUserId: 'all',
    organizationId: 'all',
    eventType: 'all',
    periodStart: '',
    periodEnd: '',
    textSearch: '',
    sortOrder: 'desc',
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof listReportActivities>> | null>(null);
  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(null);
  const organizationFilterEnabled = result?.scope.organizationFilterEnabled ?? false;
  const isProfileLimited = result?.scope.limitedByProfile ?? false;
  const debouncedSearch = useDebouncedValue(filters.textSearch || '', 350);
  const debouncedFilters = useMemo(
    () => ({ ...filters, textSearch: debouncedSearch }),
    [filters, debouncedSearch],
  );

  useEffect(() => {
    if (organizationFilterEnabled) return;
    setFilters((prev) => (prev.organizationId === 'all' ? prev : { ...prev, organizationId: 'all' }));
  }, [organizationFilterEnabled]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await listReportActivities(debouncedFilters, { page, pageSize: PAGE_SIZE }, { defaultOrgId, operationalOnly });
        setResult(data);
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar relatório.');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [debouncedFilters, page, defaultOrgId, operationalOnly]);

  const totalPages = useMemo(() => {
    if (!result) return 1;
    return Math.max(1, Math.ceil(result.total / result.pageSize));
  }, [result]);

  const exportCsv = async () => {
    const full = await listReportActivities(debouncedFilters, { page: 1, pageSize: 10000 }, { defaultOrgId, operationalOnly });
    const headers = ['Protocolo', 'Título', 'Cliente', 'Status', 'Tipo', 'Responsável', 'Usuário ator', 'Organização', 'Último evento', 'Data cadastro'];
    const rows = full.rows.map((row) => [
      row.process.protocolo || '',
      row.process.titulo || '',
      row.process.cliente_nome || '',
      row.process.process_status || row.process.status || '',
      row.process.unidade_atendimento || '',
      row.responsibleName,
      row.actorName,
      row.organizationName,
      row.latestEvent?.mensagem || '',
      new Date(row.process.created_at).toLocaleString('pt-BR'),
    ]);

    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell || '').replaceAll('"', '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-processos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    const full = await listReportActivities(debouncedFilters, { page: 1, pageSize: 10000 }, { defaultOrgId, operationalOnly });
    const htmlRows = full.rows
      .map(
        (row: ReportRow) => `
          <tr>
            <td>${row.process.protocolo || '-'}</td>
            <td>${row.process.titulo || '-'}</td>
            <td>${row.process.cliente_nome || '-'}</td>
            <td>${row.process.process_status || row.process.status || '-'}</td>
            <td>${row.process.unidade_atendimento || '-'}</td>
            <td>${row.responsibleName}</td>
            <td>${row.actorName}</td>
            <td>${row.organizationName}</td>
          </tr>
        `,
      )
      .join('');

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório de Processos</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 6px; font-size: 12px; text-align: left; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h2>Relatório de Processos</h2>
          <p>Total de registros: ${full.total}</p>
          <table>
            <thead>
              <tr><th>Protocolo</th><th>Título</th><th>Cliente</th><th>Status</th><th>Tipo</th><th>Responsável</th><th>Usuário ator</th><th>Organização</th></tr>
            </thead>
            <tbody>${htmlRows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input type="date" value={filters.periodStart || ''} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, periodStart: e.target.value })); }} className="rounded-lg border border-gray-200 p-2 text-sm" />
          <input type="date" value={filters.periodEnd || ''} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, periodEnd: e.target.value })); }} className="rounded-lg border border-gray-200 p-2 text-sm" />
          <select value={filters.processStatus || 'all'} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, processStatus: e.target.value })); }} className="rounded-lg border border-gray-200 p-2 text-sm">
            <option value="all">Todos os status</option>
            {result?.options.statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={filters.processType || 'all'} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, processType: e.target.value })); }} className="rounded-lg border border-gray-200 p-2 text-sm">
            <option value="all">Todos os tipos</option>
            {result?.options.types.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={filters.responsibleUserId || 'all'} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, responsibleUserId: e.target.value })); }} className="rounded-lg border border-gray-200 p-2 text-sm">
            <option value="all">Todos os responsáveis</option>
            {result?.options.responsibles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={filters.actorUserId || 'all'} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, actorUserId: e.target.value })); }} className="rounded-lg border border-gray-200 p-2 text-sm">
            <option value="all">Todos os usuários ator</option>
            {result?.options.actors.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {organizationFilterEnabled ? (
            <select value={filters.organizationId || 'all'} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, organizationId: e.target.value })); }} className="rounded-lg border border-gray-200 p-2 text-sm">
              <option value="all">Todas as organizações</option>
              {result?.options.organizations.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          ) : null}
          <select value={filters.eventType || 'all'} onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, eventType: e.target.value })); }} className="rounded-lg border border-gray-200 p-2 text-sm">
            <option value="all">Todos os tipos de evento</option>
            {result?.options.eventTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        {isProfileLimited ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            Dados limitados ao seu perfil.
          </div>
        ) : null}

        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-xl">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={filters.textSearch || ''}
              onChange={(e) => { setPage(1); setFilters((p) => ({ ...p, textSearch: e.target.value })); }}
              placeholder="Buscar por protocolo, título, cliente ou mensagem de evento"
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filters.sortOrder || 'desc'}
              onChange={(e) => {
                setPage(1);
                setFilters((p) => ({ ...p, sortOrder: e.target.value as 'asc' | 'desc' }));
              }}
              className="rounded-lg border border-gray-200 px-2 py-2 text-xs font-semibold"
            >
              <option value="desc">Mais recente</option>
              <option value="asc">Mais antigo</option>
            </select>
            <button onClick={() => void exportCsv()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"><Download className="h-4 w-4" /> CSV</button>
            <button onClick={() => void exportPdf()} className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-xs font-bold text-white"><FileText className="h-4 w-4" /> PDF</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4"><p className="text-xs text-gray-500">Total filtrado</p><p className="text-2xl font-black text-gray-900">{result?.summary.total || 0}</p></div>
        <div className="rounded-xl border border-gray-100 bg-white p-4"><p className="text-xs text-gray-500">Status (top)</p><p className="text-sm font-bold text-gray-900">{result?.summary.byStatus.sort((a,b)=>b.total-a.total)[0]?.key || '-'}</p><p className="text-xs text-gray-500">{result?.summary.byStatus.sort((a,b)=>b.total-a.total)[0]?.total || 0}</p></div>
        <div className="rounded-xl border border-gray-100 bg-white p-4"><p className="text-xs text-gray-500">Evento (top)</p><p className="text-sm font-bold text-gray-900">{result?.summary.byEventType.sort((a,b)=>b.total-a.total)[0]?.key || '-'}</p><p className="text-xs text-gray-500">{result?.summary.byEventType.sort((a,b)=>b.total-a.total)[0]?.total || 0}</p></div>
        <div className="rounded-xl border border-gray-100 bg-white p-4"><p className="text-xs text-gray-500">Usuário ator (top)</p><p className="text-sm font-bold text-gray-900">{result?.summary.byActor.sort((a,b)=>b.total-a.total)[0]?.key || '-'}</p><p className="text-xs text-gray-500">{result?.summary.byActor.sort((a,b)=>b.total-a.total)[0]?.total || 0}</p></div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-4"><p className="text-xs text-gray-500">Consolidado por organização (top)</p><p className="text-sm font-bold text-gray-900">{result?.summary.byOrganization.sort((a,b)=>b.total-a.total)[0]?.key || '-'}</p><p className="text-xs text-gray-500">{result?.summary.byOrganization.sort((a,b)=>b.total-a.total)[0]?.total || 0}</p></div>
        <div className="rounded-xl border border-gray-100 bg-white p-4"><p className="text-xs text-gray-500">Consolidado por usuário (top)</p><p className="text-sm font-bold text-gray-900">{result?.summary.byUser.sort((a,b)=>b.total-a.total)[0]?.key || '-'}</p><p className="text-xs text-gray-500">{result?.summary.byUser.sort((a,b)=>b.total-a.total)[0]?.total || 0}</p></div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
        {error && <div className="p-3 text-sm text-red-600">{error}</div>}
        {loading ? (
          <div className="p-4 text-sm text-gray-500">Carregando...</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Protocolo</th><th className="px-3 py-2 text-left">Título</th><th className="px-3 py-2 text-left">Cliente</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Tipo</th><th className="px-3 py-2 text-left">Responsável</th><th className="px-3 py-2 text-left">Usuário ator</th><th className="px-3 py-2 text-left">Org.</th><th className="px-3 py-2 text-left">Último evento</th>
              </tr>
            </thead>
            <tbody>
              {result?.rows.map((row) => {
                const isExpanded = expandedProcessId === row.process.id;
                return (
                  <React.Fragment key={row.process.id}>
                    <tr className="border-t border-gray-100">
                      <td className="px-3 py-2 font-bold">{row.process.protocolo || '-'}</td>
                      <td className="px-3 py-2">{row.process.titulo}</td>
                      <td className="px-3 py-2">{row.process.cliente_nome || '-'}</td>
                      <td className="px-3 py-2">{row.process.process_status || row.process.status || '-'}</td>
                      <td className="px-3 py-2">{row.process.unidade_atendimento || '-'}</td>
                      <td className="px-3 py-2">{row.responsibleName}</td>
                      <td className="px-3 py-2">{row.actorName}</td>
                      <td className="px-3 py-2">{row.organizationName}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setExpandedProcessId((current) => current === row.process.id ? null : row.process.id)}
                          className="inline-flex items-start gap-1 text-left text-blue-600 hover:underline"
                        >
                          <span>{row.latestEvent?.mensagem || '-'}</span>
                          {isExpanded ? <ChevronUp className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" />}
                        </button>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-t border-gray-100 bg-gray-50">
                        <td className="px-3 py-2" colSpan={9}>
                          <p className="mb-2 text-xs font-bold uppercase text-gray-500">Timeline detalhada</p>
                          <ul className="space-y-1 text-xs text-gray-700">
                            {row.events.map((event) => (
                              <li key={event.id}>
                                {new Date(event.created_at).toLocaleString('pt-BR')} · {event.event_type || event.tipo}
                                {event.field ? ` · ${event.field}` : ''} · {event.mensagem}
                                {(event.old_value || event.new_value) ? ` (${event.old_value || '∅'} → ${event.new_value || '∅'})` : ''}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500">Página {page} de {totalPages}</p>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-gray-200 px-3 py-1 text-xs font-bold disabled:opacity-50">Anterior</button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded border border-gray-200 px-3 py-1 text-xs font-bold disabled:opacity-50">Próxima</button>
        </div>
      </div>
    </section>
  );
};

export default ReportsPage;
