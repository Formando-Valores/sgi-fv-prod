import React from 'react';
import { Inbox, Users2, FolderKanban, MessageSquare, Calendar } from 'lucide-react';
import { ProcessStatus, type User } from '../../../../types';
import { useNavigate } from 'react-router-dom';
import Badge from '../../ui/Badge';
import EmptyState from '../../ui/EmptyState';
import ClientProcessProgressPanel, { type ClientProcessProgressHistoryItem } from '../ClientProcessProgressPanel';

interface AdminProcessRow extends User {
  processRecordId?: string;
  profileUserId?: string | null;
  processType: string;
  startDate: string;
  deadlineDate: string;
  etapaAtual: string;
  financeiro: string;
  prioridade: string;
  valor: number;
  sourceLabel: string;
  requestedOrganizationName: string;
  contractedServiceName: string;
  paymentStatus?: string | null;
  osValue?: number | null;
  servicesSelected?: { id: string; name: string; price: number; group: string }[] | null;
  associationFees?: { type: string; name: string; price: number; destination: string }[] | null;
}

const statusBadgeVariant = (status: ProcessStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
  if (status === ProcessStatus.CONCLUIDO) return 'success';
  if (status === ProcessStatus.ANALISE) return 'warning';
  if (status === ProcessStatus.TRIAGEM) return 'info';
  return 'neutral';
};

const clientStatusLabelMap: Record<ProcessStatus, string> = {
  [ProcessStatus.PENDENTE]: 'Em atendimento inicial',
  [ProcessStatus.TRIAGEM]: 'Coleta em andamento',
  [ProcessStatus.ANALISE]: 'Análise em andamento',
  [ProcessStatus.CONCLUIDO]: 'Concluído',
};

const clientStepByStatus: Record<ProcessStatus, number> = {
  [ProcessStatus.PENDENTE]: 0,
  [ProcessStatus.TRIAGEM]: 1,
  [ProcessStatus.ANALISE]: 2,
  [ProcessStatus.CONCLUIDO]: 4,
};

interface DashboardSectionProps {
  dashboardProcessRows: AdminProcessRow[];
  usersCount: number;
  filteredUsersCount: number;
  isClientScope: boolean;
  canAccessSection: (sectionName: string) => boolean;
  navigateToDashboardHighlight: (targetSection: string, presetFilter: string) => void;
  setSelectedUser: React.Dispatch<React.SetStateAction<AdminProcessRow | User | null>>;
  OverviewContainer: React.ComponentType<{ children: React.ReactNode }>;
  clientJourneyHistory: ClientProcessProgressHistoryItem[];
  clientJourneyLoading: boolean;
}

const DashboardSection: React.FC<DashboardSectionProps> = ({
  dashboardProcessRows,
  usersCount,
  filteredUsersCount,
  isClientScope,
  canAccessSection,
  navigateToDashboardHighlight,
  setSelectedUser,
  OverviewContainer,
  clientJourneyHistory,
  clientJourneyLoading,
}) => {
  const navigate = useNavigate();

  const dashboardProcessStats = {
    total: dashboardProcessRows.length,
    emAndamento: dashboardProcessRows.filter((process) => process.status !== ProcessStatus.CONCLUIDO).length,
    concluidos: dashboardProcessRows.filter((process) => process.status === ProcessStatus.CONCLUIDO).length,
    aguardando: dashboardProcessRows.filter((process) => process.status === ProcessStatus.PENDENTE || process.status === ProcessStatus.TRIAGEM || process.status === ProcessStatus.ANALISE).length,
    atrasados: dashboardProcessRows.filter((process) => process.status !== ProcessStatus.CONCLUIDO && Boolean(process.deadline)).length,
  };

  const dashboardHighlights = [
    {
      key: 'usuarios',
      label: 'Usuários cadastrados',
      value: usersCount,
      helper: `${filteredUsersCount} visíveis no filtro atual`,
      icon: Users2,
      styles: 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700',
      targetSection: 'configuracoes' as string,
      presetFilter: 'usuarios_cadastrados' as string,
      ariaLabel: 'Ir para a seção de configurações na aba de usuários cadastrados',
    },
    {
      key: 'processos-ativos',
      label: 'Processos em andamento',
      value: dashboardProcessStats.emAndamento,
      helper: `${dashboardProcessStats.total} processos no total`,
      icon: FolderKanban,
      styles: 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-700',
      targetSection: 'processos' as string,
      presetFilter: 'processos-em-andamento' as string,
      ariaLabel: 'Ir para a seção de processos em andamento',
    },
    {
      key: 'prioridade',
      label: 'Demandas que exigem atenção',
      value: dashboardProcessRows.filter((process) => process.status === ProcessStatus.TRIAGEM || process.status === ProcessStatus.ANALISE).length,
      helper: 'Triagem + Análise',
      icon: MessageSquare,
      styles: 'border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 text-amber-700',
      targetSection: 'processos' as string,
      presetFilter: 'processos-prioridade' as string,
      ariaLabel: 'Ir para a seção de processos com foco em demandas prioritárias',
    },
    {
      key: 'novos',
      label: 'Novos nos últimos 7 dias',
      value: dashboardProcessRows.filter((process) => {
        if (!process.registrationDate) return false;
        const parsedDate = new Date(process.registrationDate);
        if (Number.isNaN(parsedDate.getTime())) return false;
        const now = new Date();
        const diffMs = now.getTime() - parsedDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      }).length,
      helper: 'Velocidade de entrada',
      icon: Calendar,
      styles: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700',
      targetSection: 'processos' as string,
      presetFilter: 'processos-novos-7d' as string,
      ariaLabel: 'Ir para a seção de processos com filtro de últimos sete dias',
    },
  ];

  const statusDistribution = [
    { label: 'Triagem', value: dashboardProcessRows.filter((process) => process.status === ProcessStatus.TRIAGEM).length, color: '#4F8FE8' },
    { label: 'Em andamento', value: dashboardProcessRows.filter((process) => process.status === ProcessStatus.ANALISE).length, color: '#F5B83B' },
    { label: 'Cadastro', value: dashboardProcessRows.filter((process) => process.status === ProcessStatus.PENDENTE).length, color: '#8C6DD7' },
    { label: 'Concluído', value: dashboardProcessRows.filter((process) => process.status === ProcessStatus.CONCLUIDO).length, color: '#52B788' },
  ];

  const serviceDistribution = Array.from(
    dashboardProcessRows.reduce<Map<string, number>>((accumulator, process) => {
      accumulator.set(process.processType, (accumulator.get(process.processType) || 0) + 1);
      return accumulator;
    }, new Map<string, number>()),
  ).map(([label, value], index) => ({
    label,
    value,
    color: ['#4F8FE8', '#52B788', '#8C6DD7', '#F5B83B'][index % 4],
  }));

  const totalForStatus = statusDistribution.reduce((sum, item) => sum + item.value, 0) || 1;
  const totalForService = serviceDistribution.reduce((sum, item) => sum + item.value, 0) || 1;

  const statusDonutStyle = {
    background: `conic-gradient(${statusDistribution
      .map((item, index) => {
        const start = statusDistribution.slice(0, index).reduce((sum, segment) => sum + segment.value, 0);
        const end = start + item.value;
        return `${item.color} ${(start / totalForStatus) * 100}% ${(end / totalForStatus) * 100}%`;
      })
      .join(', ')})`,
  };

  const serviceDonutStyle = {
    background: `conic-gradient(${serviceDistribution
      .map((item, index) => {
        const start = serviceDistribution.slice(0, index).reduce((sum, segment) => sum + segment.value, 0);
        const end = start + item.value;
        return `${item.color} ${(start / totalForService) * 100}% ${(end / totalForService) * 100}%`;
      })
      .join(', ')})`,
  };

  const dashboardRecentRows = dashboardProcessRows.slice(0, 5);
  const clientPrimaryProcess = isClientScope ? dashboardProcessRows[0] : null;

  return (
    <>
      <OverviewContainer>
        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5 no-print">
          {dashboardHighlights.map((item) => {
            const canNavigateToHighlight = canAccessSection(item.targetSection);
            return (
              <button
                key={item.key}
                type="button"
                aria-label={item.ariaLabel}
                aria-disabled={!canNavigateToHighlight}
                disabled={!canNavigateToHighlight}
                onClick={() => {
                  if (!canNavigateToHighlight) return;
                  navigateToDashboardHighlight(item.targetSection, item.presetFilter);
                }}
                onKeyDown={(event) => {
                  if (!canNavigateToHighlight) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigateToDashboardHighlight(item.targetSection, item.presetFilter);
                  }
                }}
                className={`rounded-2xl border p-4 shadow-sm ${item.styles} min-h-[112px] text-left transition outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 ${canNavigateToHighlight ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-widest leading-tight">{item.label}</p>
                  <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-3xl font-black leading-none">{item.value}</p>
                <p className="mt-1.5 text-xs font-semibold opacity-70">{item.helper}</p>
              </button>
            );
          })}
        </section>
      </OverviewContainer>

      <OverviewContainer>
        {isClientScope && (
          <section className="mb-6 no-print">
            <ClientProcessProgressPanel
              serviceName={clientPrimaryProcess?.contractedServiceName || 'Nenhum serviço contratado ainda'}
              responsibleSector={clientPrimaryProcess?.processType || 'Setor não definido'}
              currentStatus={clientPrimaryProcess ? clientStatusLabelMap[clientPrimaryProcess.status] : 'Sem processo ativo'}
              currentStepIndex={clientPrimaryProcess ? clientStepByStatus[clientPrimaryProcess.status] : 0}
              history={clientJourneyLoading ? [{ id: 'loading', dateLabel: 'Carregando', message: 'Buscando histórico do processo...' }] : clientJourneyHistory}
            />
          </section>
        )}
        <section className="mb-6 space-y-4 no-print">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="text-base font-black text-gray-800">Processos por status</h3>
              <p className="text-xs font-semibold text-gray-500">Distribuição atual dos processos cadastrados</p>
              <div className="mt-4 flex flex-col md:flex-row gap-6 items-center">
                <div className="relative h-40 w-40 rounded-full" style={statusDonutStyle}>
                  <div className="absolute inset-5 rounded-full bg-white flex flex-col items-center justify-center">
                    <p className="text-3xl font-black text-gray-800">{dashboardProcessStats.total}</p>
                    <p className="text-xs font-semibold text-gray-500">Total</p>
                  </div>
                </div>
                <div className="w-full space-y-2">
                  {statusDistribution.map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-gray-700">{item.label}</span>
                      </div>
                      <span className="font-black text-gray-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="text-base font-black text-gray-800">Processos em andamento por serviço</h3>
              <p className="text-xs font-semibold text-gray-500">Distribuição dos processos em andamento</p>
              <div className="mt-4 flex flex-col md:flex-row gap-6 items-center">
                <div className="relative h-40 w-40 rounded-full" style={serviceDonutStyle}>
                  <div className="absolute inset-5 rounded-full bg-white flex flex-col items-center justify-center">
                    <p className="text-3xl font-black text-gray-800">{dashboardProcessStats.emAndamento}</p>
                    <p className="text-xs font-semibold text-gray-500">Ativos</p>
                  </div>
                </div>
                <div className="w-full space-y-2">
                  {serviceDistribution.length === 0 ? (
                    <p className="text-sm text-gray-500 font-semibold">Sem dados para exibir.</p>
                  ) : serviceDistribution.map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-gray-700">{item.label}</span>
                      </div>
                      <span className="font-black text-gray-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <article className="xl:col-span-2 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-gray-800">Evolução dos processos</h3>
                <p className="text-xs font-bold text-blue-600">TOTAL: {dashboardHighlights[3].value} novos processos</p>
              </div>
              <p className="text-xs font-semibold text-gray-500 mb-3">Novos processos cadastrados nos últimos 7 dias</p>
              <div className="grid grid-cols-7 gap-2 items-end h-36">
                {[...Array(7)].map((_, index) => {
                  const date = new Date();
                  date.setDate(date.getDate() - (6 - index));
                  const isoDay = date.toISOString().slice(0, 10);
                  const dayCount = dashboardProcessRows.filter((process) => (process.registrationDate || '').slice(0, 10) === isoDay).length;
                  const barHeight = Math.max(12, dayCount * 18);

                  return (
                    <div key={isoDay} className="flex flex-col items-center gap-2">
                      <div className="w-full rounded-md bg-blue-100/80 relative" style={{ height: `${barHeight}px` }}>
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-black text-blue-600">{dayCount}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-gray-500">{isoDay.slice(8, 10)}/{isoDay.slice(5, 7)}</span>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="text-base font-black text-gray-800">Tempo médio em andamento</h3>
              <p className="text-xs font-semibold text-gray-500 mb-3">Média de dias por serviço</p>
              <div className="space-y-2">
                {serviceDistribution.slice(0, 3).map((service, index) => {
                  const serviceRows = dashboardProcessRows.filter((row) => row.processType === service.label);
                  const daysAverage = serviceRows.length === 0
                    ? 0
                    : (serviceRows.reduce((acc, row) => {
                      const diff = (Date.now() - new Date(row.registrationDate).getTime()) / (1000 * 60 * 60 * 24);
                      return acc + (Number.isFinite(diff) ? diff : 0);
                    }, 0) / serviceRows.length);
                  const cardStyles = ['bg-blue-50 text-blue-700', 'bg-emerald-50 text-emerald-700', 'bg-violet-50 text-violet-700'][index % 3];

                  return (
                    <div key={service.label} className={`rounded-xl p-3 ${cardStyles}`}>
                      <p className="text-xl font-black">{daysAverage.toFixed(1)} dias</p>
                      <p className="text-xs font-semibold">{service.label}</p>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>

          <article className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-black text-gray-800">Processos recentes</h3>
                <p className="text-xs font-semibold text-gray-500">Últimos processos cadastrados</p>
              </div>
              <button onClick={() => navigate('/dashboard/processos')} className="text-xs font-black text-blue-600">
                Ver todos os processos
              </button>
            </div>
            {dashboardRecentRows.length === 0 ? (
              <EmptyState icon={Inbox} title="Nenhum processo encontrado" description="Ainda não há processos cadastrados no sistema." />
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left">Protocolo</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left">OS</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left">Serviço</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left">Status</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left">Abertura</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left">Setor responsável</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardRecentRows.map((process) => (
                        <tr key={process.id} className="border-t border-gray-100">
                          <td className="px-3 sm:px-4 py-2 sm:py-3 font-bold text-gray-800">{process.protocol}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-600">{process.processRecordId}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-700">{process.processType}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3"><Badge variant={statusBadgeVariant(process.status)} className="text-xs px-2 py-1">{process.status}</Badge></td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-600">{process.startDate}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-600">{process.serviceManager || 'Não definido'}</td>
                          <td className="px-3 sm:px-4 py-2 sm:py-3">
                            <button onClick={() => setSelectedUser(process)} className="text-blue-600 font-bold text-xs whitespace-nowrap">Abrir acompanhamento</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="block md:hidden space-y-3">
                  {dashboardRecentRows.map((process) => (
                    <div key={process.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{process.protocol}</p>
                          <span className="text-[10px] font-black text-gray-500 inline-block mt-1">{process.processType}</span>
                        </div>
                        <Badge variant={statusBadgeVariant(process.status)} className="text-xs px-2 py-1 shrink-0">{process.status}</Badge>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p><span className="font-semibold text-gray-400">OS:</span> {process.processRecordId}</p>
                        <p><span className="font-semibold text-gray-400">Abertura:</span> {process.startDate}</p>
                        <p><span className="font-semibold text-gray-400">Setor:</span> {process.serviceManager || 'Não definido'}</p>
                      </div>
                      <button onClick={() => setSelectedUser(process)} className="mt-3 text-blue-600 font-bold text-xs">Abrir acompanhamento</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </article>
        </section>
      </OverviewContainer>
    </>
  );
};

export default DashboardSection;
