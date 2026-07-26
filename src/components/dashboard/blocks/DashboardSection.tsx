import React from 'react';
import { Inbox, Users2, FolderKanban, MessageSquare, Calendar, FilePlus, Clock } from 'lucide-react';
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
      label: isClientScope ? 'Seu Cadastro' : 'Usuários',
      value: isClientScope ? 1 : usersCount,
      helper: isClientScope ? 'Informações do cadastro' : `${filteredUsersCount} visíveis`,
      icon: Users2,
      colors: 'bg-brand-50 text-brand-700 ring-brand-100',
      iconBg: 'bg-brand-100',
      targetSection: 'configuracoes' as string,
      presetFilter: 'usuarios_cadastrados' as string,
    },
    {
      key: 'processos-ativos',
      label: isClientScope ? 'Seu Processo' : 'Em andamento',
      value: dashboardProcessStats.emAndamento,
      helper: isClientScope ? 'Acompanhe o andamento' : `${dashboardProcessStats.total} total`,
      icon: FolderKanban,
      colors: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
      iconBg: 'bg-indigo-100',
      targetSection: 'processos' as string,
      presetFilter: 'processos-em-andamento' as string,
    },
    {
      key: 'prioridade',
      label: isClientScope ? 'Providências' : 'Atenção',
      value: dashboardProcessRows.filter((process) => process.status === ProcessStatus.TRIAGEM || process.status === ProcessStatus.ANALISE).length,
      helper: isClientScope ? 'Necessárias' : 'Triagem + Análise',
      icon: MessageSquare,
      colors: 'bg-amber-50 text-amber-700 ring-amber-100',
      iconBg: 'bg-amber-100',
      targetSection: 'processos' as string,
      presetFilter: 'processos-prioridade' as string,
    },
    {
      key: 'novos',
      label: isClientScope ? 'Serviços' : 'Novos (7d)',
      value: dashboardProcessRows.filter((process) => {
        if (!process.registrationDate) return false;
        const parsedDate = new Date(process.registrationDate);
        if (Number.isNaN(parsedDate.getTime())) return false;
        const now = new Date();
        const diffMs = now.getTime() - parsedDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      }).length,
      helper: isClientScope ? 'Disponíveis' : 'Velocidade de entrada',
      icon: Calendar,
      colors: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
      iconBg: 'bg-emerald-100',
      targetSection: 'processos' as string,
      presetFilter: 'processos-novos-7d' as string,
    },
  ];

  const statusDistribution = [
    { label: 'Triagem', value: dashboardProcessRows.filter((process) => process.status === ProcessStatus.TRIAGEM).length, color: '#3378fc' },
    { label: 'Em andamento', value: dashboardProcessRows.filter((process) => process.status === ProcessStatus.ANALISE).length, color: '#f59e0b' },
    { label: 'Cadastro', value: dashboardProcessRows.filter((process) => process.status === ProcessStatus.PENDENTE).length, color: '#8b5cf6' },
    { label: 'Concluído', value: dashboardProcessRows.filter((process) => process.status === ProcessStatus.CONCLUIDO).length, color: '#10b981' },
  ];

  const serviceDistribution = Array.from(
    dashboardProcessRows.reduce<Map<string, number>>((accumulator, process) => {
      accumulator.set(process.processType, (accumulator.get(process.processType) || 0) + 1);
      return accumulator;
    }, new Map<string, number>()),
  ).map(([label, value], index) => ({
    label,
    value,
    color: ['#3378fc', '#10b981', '#8b5cf6', '#f59e0b'][index % 4],
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
        {isClientScope ? (
          <>
            <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 no-print">
              {[
                {
                  key: 'novo-processo',
                  label: 'Novo Processo',
                  value: dashboardProcessStats.emAndamento,
                  helper: 'Processos em andamento',
                  icon: FilePlus,
                  colors: 'bg-brand-50 text-brand-700 ring-brand-100',
                  iconBg: 'bg-brand-100',
                  action: () => navigate('/dashboard/processos?novo=1'),
                },
                {
                  key: 'ultimas-atividades',
                  label: 'Últimas Atividades',
                  value: clientJourneyHistory.length,
                  helper: clientJourneyHistory.length > 0 ? 'Clique para acompanhar' : 'Nenhuma atividade recente',
                  icon: Clock,
                  colors: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
                  iconBg: 'bg-indigo-100',
                  action: () => {
                    document.getElementById('client-journey')?.scrollIntoView({ behavior: 'smooth' });
                  },
                },
                {
                  key: 'posicao-pedidos',
                  label: 'Posição dos pedidos',
                  value: dashboardProcessRows.filter((process) => process.status === ProcessStatus.TRIAGEM || process.status === ProcessStatus.ANALISE).length,
                  helper: 'Status de cada processo',
                  icon: MessageSquare,
                  colors: 'bg-amber-50 text-amber-700 ring-amber-100',
                  iconBg: 'bg-amber-100',
                  action: () => navigate('/dashboard/processos'),
                },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.action}
                  className={`rounded-2xl border border-surface-200/60 p-5 shadow-card hover:shadow-card-hover transition-all duration-200 ${item.colors} min-h-[120px] text-left cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500`}
                >
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest leading-tight opacity-80">{item.label}</p>
                    <div className={`w-9 h-9 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0`}>
                      <item.icon className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold leading-none">{item.value}</p>
                  <p className="mt-2 text-xs font-medium opacity-70">{item.helper}</p>
                </button>
              ))}
            </section>

            <section id="client-journey" className="mb-6 no-print">
              <ClientProcessProgressPanel
                serviceName={clientPrimaryProcess?.contractedServiceName || 'Nenhum serviço contratado ainda'}
                responsibleSector={clientPrimaryProcess?.processType || 'Setor não definido'}
                currentStatus={clientPrimaryProcess ? clientStatusLabelMap[clientPrimaryProcess.status] : 'Sem processo ativo'}
                currentStepIndex={clientPrimaryProcess ? clientStepByStatus[clientPrimaryProcess.status] : 0}
                history={clientJourneyLoading ? [{ id: 'loading', dateLabel: 'Carregando', message: 'Buscando histórico do processo...' }] : clientJourneyHistory}
              />
            </section>
          </>
        ) : (
          <>
            {/* Highlight cards */}
            <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4 no-print">
              {dashboardHighlights.map((item) => {
                const canNavigateToHighlight = canAccessSection(item.targetSection);
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-disabled={!canNavigateToHighlight}
                    disabled={!canNavigateToHighlight}
                    onClick={() => {
                      if (!canNavigateToHighlight) return;
                      navigateToDashboardHighlight(item.targetSection, item.presetFilter);
                    }}
                    className={`rounded-2xl border border-surface-200/60 p-5 shadow-card hover:shadow-card-hover transition-all duration-200 ${item.colors} min-h-[120px] text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500 ${canNavigateToHighlight ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                  >
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest leading-tight opacity-80">{item.label}</p>
                      <div className={`w-9 h-9 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0`}>
                        <item.icon className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-3xl font-extrabold leading-none">{item.value}</p>
                    <p className="mt-2 text-xs font-medium opacity-70">{item.helper}</p>
                  </button>
                );
              })}
            </section>

            {/* Charts */}
            <section className="mb-6 space-y-4 no-print">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <article className="rounded-2xl border border-surface-200/60 bg-white p-5 shadow-card">
                  <h3 className="text-base font-extrabold text-surface-800">Processos por status</h3>
                  <p className="text-xs font-medium text-surface-500">Distribuição atual</p>
                  <div className="mt-4 flex flex-col md:flex-row gap-6 items-center">
                    <div className="relative h-40 w-40 rounded-full shrink-0" style={statusDonutStyle}>
                      <div className="absolute inset-5 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                        <p className="text-3xl font-extrabold text-surface-800">{dashboardProcessStats.total}</p>
                        <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Total</p>
                      </div>
                    </div>
                    <div className="w-full space-y-2.5">
                      {statusDistribution.map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2.5">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="font-medium text-surface-600">{item.label}</span>
                          </div>
                          <span className="font-extrabold text-surface-800">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>

                <article className="rounded-2xl border border-surface-200/60 bg-white p-5 shadow-card">
                  <h3 className="text-base font-extrabold text-surface-800">Processos por serviço</h3>
                  <p className="text-xs font-medium text-surface-500">Distribuição dos processos ativos</p>
                  <div className="mt-4 flex flex-col md:flex-row gap-6 items-center">
                    <div className="relative h-40 w-40 rounded-full shrink-0" style={serviceDonutStyle}>
                      <div className="absolute inset-5 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                        <p className="text-3xl font-extrabold text-surface-800">{dashboardProcessStats.emAndamento}</p>
                        <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Ativos</p>
                      </div>
                    </div>
                    <div className="w-full space-y-2.5">
                      {serviceDistribution.length === 0 ? (
                        <p className="text-sm text-surface-500 font-medium">Sem dados para exibir.</p>
                      ) : serviceDistribution.map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2.5">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="font-medium text-surface-600">{item.label}</span>
                          </div>
                          <span className="font-extrabold text-surface-800">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              </div>

              {/* Bar chart + time */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <article className="xl:col-span-2 rounded-2xl border border-surface-200/60 bg-white p-5 shadow-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-surface-800">Evolução dos processos</h3>
                      <p className="text-xs font-medium text-surface-500">Últimos 7 dias</p>
                    </div>
                    <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-lg">{dashboardHighlights[3].value} novos</span>
                  </div>
                  <div className="mt-4 grid grid-cols-7 gap-2 items-end h-36">
                    {[...Array(7)].map((_, index) => {
                      const date = new Date();
                      date.setDate(date.getDate() - (6 - index));
                      const isoDay = date.toISOString().slice(0, 10);
                      const dayCount = dashboardProcessRows.filter((process) => (process.registrationDate || '').slice(0, 10) === isoDay).length;
                      const barHeight = Math.max(8, dayCount * 20);

                      return (
                        <div key={isoDay} className="flex flex-col items-center gap-2">
                          <span className="text-[10px] font-bold text-brand-600">{dayCount}</span>
                          <div className="w-full rounded-lg bg-brand-100 relative overflow-hidden" style={{ height: `${barHeight}px` }}>
                            <div className="absolute inset-0 bg-brand-500/80 rounded-lg" style={{ height: '100%' }} />
                          </div>
                          <span className="text-[10px] font-medium text-surface-400">{isoDay.slice(8, 10)}/{isoDay.slice(5, 7)}</span>
                        </div>
                      );
                    })}
                  </div>
                </article>

                <article className="rounded-2xl border border-surface-200/60 bg-white p-5 shadow-card">
                  <h3 className="text-base font-extrabold text-surface-800">Tempo médio</h3>
                  <p className="text-xs font-medium text-surface-500 mb-3">Dias em andamento</p>
                  <div className="space-y-2.5">
                    {serviceDistribution.slice(0, 3).map((service, index) => {
                      const serviceRows = dashboardProcessRows.filter((row) => row.processType === service.label);
                      const daysAverage = serviceRows.length === 0
                        ? 0
                        : (serviceRows.reduce((acc, row) => {
                          const diff = (Date.now() - new Date(row.registrationDate).getTime()) / (1000 * 60 * 60 * 24);
                          return acc + (Number.isFinite(diff) ? diff : 0);
                        }, 0) / serviceRows.length);
                      const cardStyles = ['bg-brand-50 text-brand-700', 'bg-emerald-50 text-emerald-700', 'bg-violet-50 text-violet-700'][index % 3];

                      return (
                        <div key={service.label} className={`rounded-xl p-3 ${cardStyles}`}>
                          <p className="text-2xl font-extrabold">{daysAverage.toFixed(1)}<span className="text-xs font-medium opacity-70 ml-1">dias</span></p>
                          <p className="text-xs font-semibold opacity-80">{service.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </article>
              </div>

              {/* Recent processes table */}
              <article className="rounded-2xl border border-surface-200/60 bg-white shadow-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
                  <div>
                    <h3 className="text-base font-extrabold text-surface-800">Processos recentes</h3>
                    <p className="text-xs font-medium text-surface-500">Últimos cadastrados</p>
                  </div>
                  <button onClick={() => navigate('/dashboard/processos')} className="text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors">
                    Ver todos →
                  </button>
                </div>
                {dashboardRecentRows.length === 0 ? (
                  <EmptyState icon={Inbox} title="Nenhum processo encontrado" description="Ainda não há processos cadastrados no sistema." />
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-surface-50 text-surface-500 text-[10px] uppercase tracking-wider font-bold">
                          <tr>
                            <th className="px-4 py-2.5 text-left">Protocolo</th>
                            <th className="px-4 py-2.5 text-left">OS</th>
                            <th className="px-4 py-2.5 text-left">Serviço</th>
                            <th className="px-4 py-2.5 text-left">Status</th>
                            <th className="px-4 py-2.5 text-left">Abertura</th>
                            <th className="px-4 py-2.5 text-left">Setor</th>
                            <th className="px-4 py-2.5 text-left">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardRecentRows.map((process) => (
                            <tr key={process.id} className="border-t border-surface-100 hover:bg-surface-50/50 transition-colors">
                              <td className="px-4 py-3 font-bold text-surface-800">{process.protocol}</td>
                              <td className="px-4 py-3 text-surface-500 font-medium">{process.processRecordId}</td>
                              <td className="px-4 py-3 text-surface-600">{process.processType}</td>
                              <td className="px-4 py-3"><Badge variant={statusBadgeVariant(process.status)} size="sm">{process.status}</Badge></td>
                              <td className="px-4 py-3 text-surface-500 font-medium">{process.startDate}</td>
                              <td className="px-4 py-3 text-surface-500">{process.serviceManager || 'Não definido'}</td>
                              <td className="px-4 py-3">
                                <button onClick={() => setSelectedUser(process)} className="text-brand-600 font-bold text-xs hover:text-brand-700 whitespace-nowrap">Acompanhar</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="block md:hidden space-y-3 p-4">
                      {dashboardRecentRows.map((process) => (
                        <div key={process.id} className="bg-surface-50 border border-surface-200/60 rounded-xl p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-bold text-surface-800 text-sm">{process.protocol}</p>
                              <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider inline-block mt-1">{process.processType}</span>
                            </div>
                            <Badge variant={statusBadgeVariant(process.status)} size="sm">{process.status}</Badge>
                          </div>
                          <div className="space-y-1 text-xs text-surface-600">
                            <p><span className="font-semibold text-surface-400">OS:</span> {process.processRecordId}</p>
                            <p><span className="font-semibold text-surface-400">Abertura:</span> {process.startDate}</p>
                            <p><span className="font-semibold text-surface-400">Setor:</span> {process.serviceManager || 'Não definido'}</p>
                          </div>
                          <button onClick={() => setSelectedUser(process)} className="mt-3 text-brand-600 font-bold text-xs hover:text-brand-700">Acompanhar</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </article>
            </section>
          </>
        )}
      </OverviewContainer>
    </>
  );
};

export default DashboardSection;
