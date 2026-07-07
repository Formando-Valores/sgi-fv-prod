import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, FileText, Search } from 'lucide-react';
import { listReportActivities, type ReportFilters, type ReportRow } from '../../lib/reports';
import { formatEuro } from '../../lib/servicesCatalog';
import { listPendingPaymentsForReconciliation, type PendingPaymentRow } from '../../lib/paymentsReconciliation';
import { TableSkeleton } from '../../components/ui/Skeleton';

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
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentRow[]>([]);
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



  useEffect(() => {
    const runPending = async () => {
      try {
        const rows = await listPendingPaymentsForReconciliation(15, 20);
        setPendingPayments(rows);
      } catch (err) {
        console.error('Falha ao carregar pendências de reconciliação', err);
      }
    };
    void runPending();
  }, []);
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
          <section class="process-block">
            <h3>${row.process.protocolo || '-'} · ${row.process.titulo || '-'}</h3>
            <p><strong>Cliente:</strong> ${row.process.cliente_nome || '-'} · <strong>Organização:</strong> ${row.organizationName}</p>
            <p><strong>Status:</strong> ${row.process.process_status || row.process.status || '-'} · <strong>Fase:</strong> ${row.process.unidade_atendimento || '-'}</p>
            <p><strong>Responsável:</strong> ${row.responsibleName} · <strong>Último ator:</strong> ${row.actorName}</p>
            <p><strong>Ações/Apontamentos:</strong> ${row.eventCount}</p>
            <p><strong>Documentos/Anexos:</strong> ${row.attachments.length ? row.attachments.map((a) => a.name).join(', ') : 'Nenhum'}</p>
            <p><strong>Eventos financeiros relevantes:</strong> ${row.financialHighlights.length ? row.financialHighlights.map((event) => `${event.type}: ${event.message}`).join(' | ') : 'Nenhum'}</p>
            <p><strong>Pagamentos:</strong> ${row.payments.length ? row.payments.map((payment) => `${payment.paymentStatus || 'sem status'} ${payment.amount != null ? `- ${formatEuro(Number(payment.amount))}` : ''}`).join(' | ') : 'Nenhum'}</p>
            <ul>
              ${row.events
                .map(
                  (event) => `<li>${new Date(event.created_at).toLocaleString('pt-BR')} · ${event.event_type || event.tipo}${event.field ? ` · ${event.field}` : ''} · ${event.mensagem}</li>`,
                )
                .join('')}
            </ul>
          </section>
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
            .process-block { border: 1px solid #ddd; border-radius: 8px; padding: 10px; margin-bottom: 12px; page-break-inside: avoid; }
            .process-block h3 { margin: 0 0 8px; }
            p { margin: 4px 0; font-size: 12px; }
            ul { margin: 8px 0 0 16px; padding: 0; }
            li { margin: 3px 0; font-size: 11px; }
          </style>
        </head>
        <body>
          <h2>Relatório Técnico Consolidado de Processos</h2>
          <p>Total de registros: ${full.total}</p>
          <p>Estrutura canônica: ações, fases, responsáveis, apontamentos, documentos e eventos financeiros relevantes.</p>
          ${full.scope.limitedByProfile ? '<p><strong>Escopo:</strong> Dados limitados ao perfil do solicitante.</p>' : ''}
          ${htmlRows}
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

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-black text-amber-900">Pendências de reconciliação financeira</h3>
          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">{pendingPayments.length} itens</span>
        </div>
        {pendingPayments.length === 0 ? (
          <p className="text-xs text-amber-800 text-center py-2">Nenhuma pendência fora da janela.</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead><tr className="text-amber-800"><th className="px-2 py-1 text-left">Protocolo</th><th className="px-2 py-1 text-left">Processo</th><th className="px-2 py-1 text-left">Valor</th><th className="px-2 py-1 text-left">Criado em</th></tr></thead>
                <tbody>
                  {pendingPayments.map((row) => (
                    <tr key={row.id} className="border-t border-amber-200">
                      <td className="px-2 py-1 font-bold">{row.process?.protocolo || '-'}</td>
                      <td className="px-2 py-1">{row.process?.titulo || row.process_id}</td>
                      <td className="px-2 py-1">{formatEuro(Number(row.amount || 0))}</td>
                      <td className="px-2 py-1">{new Date(row.created_at).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="block md:hidden space-y-2">
              {pendingPayments.map((row) => (
                <div key={row.id} className="bg-white border border-amber-300 rounded-lg p-3">
                  <p className="font-bold text-sm text-amber-900">{row.process?.protocolo || '-'}</p>
                  <p className="text-xs text-amber-800 mt-1">{row.process?.titulo || row.process_id}</p>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-amber-200">
                    <span className="text-sm font-bold text-amber-900">{formatEuro(Number(row.amount || 0))}</span>
                    <span className="text-[10px] text-amber-700">{new Date(row.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
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

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        {error && <div className="p-3 text-sm text-red-600">{error}</div>}
        {loading ? (
          <div className="p-4"><TableSkeleton rows={5} cols={8} /></div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
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
                            <button onClick={() => setExpandedProcessId((current) => current === row.process.id ? null : row.process.id)} className="inline-flex items-start gap-1 text-left text-blue-600 hover:underline">
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
                              <p className="mt-3 mb-1 text-xs font-bold uppercase text-gray-500">Financeiro</p>
                              <ul className="space-y-1 text-xs text-gray-700">
                                {row.financialHighlights.length ? row.financialHighlights.map((event, index) => (
                                  <li key={`${event.type}-${index}`}>{event.createdAt ? new Date(event.createdAt).toLocaleString('pt-BR') : '-'} · {event.type} · {event.message}</li>
                                )) : <li>Nenhum evento financeiro relevante.</li>}
                              </ul>
                              <p className="mt-3 mb-1 text-xs font-bold uppercase text-gray-500">Pagamentos</p>
                              <ul className="space-y-1 text-xs text-gray-700">
                                {row.payments.length ? row.payments.map((payment) => (
                                  <li key={payment.id}>{payment.createdAt ? new Date(payment.createdAt).toLocaleString('pt-BR') : '-'} · {payment.paymentStatus || 'sem status'}{payment.amount != null ? ` · ${formatEuro(Number(payment.amount))}` : ''}</li>
                                )) : <li>Nenhum pagamento vinculado.</li>}
                              </ul>
                              <p className="mt-3 mb-1 text-xs font-bold uppercase text-gray-500">Documentos/Anexos</p>
                              <ul className="space-y-1 text-xs text-gray-700">
                                {row.attachments.length ? row.attachments.map((attachment) => (
                                  <li key={attachment.id}>{attachment.createdAt ? new Date(attachment.createdAt).toLocaleString('pt-BR') : '-'} · {attachment.name}</li>
                                )) : <li>Nenhum anexo registrado.</li>}
                              </ul>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="block md:hidden space-y-2 p-3">
              {result?.rows.map((row) => {
                const isExpanded = expandedProcessId === row.process.id;
                return (
                  <div key={row.process.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{row.process.titulo}</p>
                        <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded inline-block mt-1">{row.process.protocolo || '-'}</span>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">{row.process.process_status || row.process.status || '-'}</span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p><span className="font-semibold text-gray-400">Cliente:</span> {row.process.cliente_nome || '-'}</p>
                      <p><span className="font-semibold text-gray-400">Tipo:</span> {row.process.unidade_atendimento || '-'}</p>
                      <p><span className="font-semibold text-gray-400">Responsável:</span> {row.responsibleName}</p>
                      <p><span className="font-semibold text-gray-400">Usuário ator:</span> {row.actorName}</p>
                      <p><span className="font-semibold text-gray-400">Org.:</span> {row.organizationName}</p>
                      {row.latestEvent?.mensagem && (
                        <p className="pt-2 mt-2 border-t border-gray-100"><span className="font-semibold text-gray-400">Último evento:</span> {row.latestEvent.mensagem}</p>
                      )}
                    </div>
                    <button onClick={() => setExpandedProcessId((current) => current === row.process.id ? null : row.process.id)} className="mt-3 flex items-center gap-1 text-xs font-bold text-blue-600">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                    </button>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                        <div>
                          <p className="text-xs font-bold uppercase text-gray-500 mb-1">Timeline detalhada</p>
                          <ul className="space-y-1 text-xs text-gray-700">
                            {row.events.map((event) => (
                              <li key={event.id}>{new Date(event.created_at).toLocaleString('pt-BR')} · {event.event_type || event.tipo}{event.field ? ` · ${event.field}` : ''} · {event.mensagem}{(event.old_value || event.new_value) ? ` (${event.old_value || '∅'} → ${event.new_value || '∅'})` : ''}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase text-gray-500 mb-1">Financeiro</p>
                          <ul className="space-y-1 text-xs text-gray-700">
                            {row.financialHighlights.length ? row.financialHighlights.map((event, index) => (
                              <li key={`${event.type}-${index}`}>{event.createdAt ? new Date(event.createdAt).toLocaleString('pt-BR') : '-'} · {event.type} · {event.message}</li>
                            )) : <li>Nenhum evento financeiro relevante.</li>}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase text-gray-500 mb-1">Pagamentos</p>
                          <ul className="space-y-1 text-xs text-gray-700">
                            {row.payments.length ? row.payments.map((payment) => (
                              <li key={payment.id}>{payment.createdAt ? new Date(payment.createdAt).toLocaleString('pt-BR') : '-'} · {payment.paymentStatus || 'sem status'}{payment.amount != null ? ` · ${formatEuro(Number(payment.amount))}` : ''}</li>
                            )) : <li>Nenhum pagamento vinculado.</li>}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase text-gray-500 mb-1">Documentos/Anexos</p>
                          <ul className="space-y-1 text-xs text-gray-700">
                            {row.attachments.length ? row.attachments.map((attachment) => (
                              <li key={attachment.id}>{attachment.createdAt ? new Date(attachment.createdAt).toLocaleString('pt-BR') : '-'} · {attachment.name}</li>
                            )) : <li>Nenhum anexo registrado.</li>}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
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
