import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ProcessStatus, ServiceUnit, User } from '../types';

type ProcessRow = {
  id: string;
  cliente: string;
  tipo: string;
  responsavel: string;
  dataInicio: string;
  prazo: string;
  status: 'EM_ANDAMENTO' | 'AGUARDANDO' | 'CONCLUIDO' | 'ATRASADO';
  etapaAtual: string;
  financeiro: 'Pago' | 'Pendente';
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA';
  valor: number;
};

/**
 * Campos pensados para persistência em SQL (exemplo):
 * process_number, client_name, process_type, owner_name, start_date, due_date,
 * process_status, current_stage, billing_status, priority, amount
 */

const STATUS = {
  EM_ANDAMENTO: { label: 'Em andamento', tone: 'success' },
  AGUARDANDO: { label: 'Aguardando', tone: 'warning' },
  CONCLUIDO: { label: 'Concluído', tone: 'info' },
  ATRASADO: { label: 'Atrasado', tone: 'danger' },
} as const;

const PRIORIDADE = {
  ALTA: { label: 'Alta', tone: 'danger' },
  MEDIA: { label: 'Média', tone: 'warning' },
  BAIXA: { label: 'Baixa', tone: 'success' },
} as const;

const ALL_COLUMNS = [
  { key: 'id', label: 'Nº Processo', width: 130 },
  { key: 'cliente', label: 'Cliente', width: 220 },
  { key: 'tipo', label: 'Tipo', width: 160 },
  { key: 'responsavel', label: 'Responsável', width: 160 },
  { key: 'dataInicio', label: 'Data Início', width: 130 },
  { key: 'prazo', label: 'Prazo', width: 120 },
  { key: 'status', label: 'Status', width: 140 },
  { key: 'etapaAtual', label: 'Etapa Atual', width: 160 },
  { key: 'financeiro', label: 'Financeiro', width: 120 },
  { key: 'prioridade', label: 'Prioridade', width: 120 },
  { key: 'valor', label: 'Valor', width: 120 },
  { key: '_actions', label: 'Ações', width: 110 },
] as const;

const mapProcessStatus = (status: ProcessStatus, prazo?: string): ProcessRow['status'] => {
  const now = new Date();
  const deadline = prazo ? new Date(prazo) : null;

  if (status === ProcessStatus.CONCLUIDO) {
    return 'CONCLUIDO';
  }

  if (deadline && !Number.isNaN(deadline.getTime()) && deadline < now) {
    return 'ATRASADO';
  }

  if (status === ProcessStatus.ANALISE || status === ProcessStatus.TRIAGEM) {
    return 'EM_ANDAMENTO';
  }

  return 'AGUARDANDO';
};

const mapUnit = (unit?: ServiceUnit) => {
  if (!unit) return 'Administrativo';
  return String(unit).charAt(0) + String(unit).slice(1).toLowerCase();
};

const mapPriority = (status: ProcessStatus): ProcessRow['prioridade'] => {
  if (status === ProcessStatus.ANALISE) return 'ALTA';
  if (status === ProcessStatus.TRIAGEM) return 'MEDIA';
  return 'BAIXA';
};

const mapValue = (status: ProcessStatus): number => {
  if (status === ProcessStatus.CONCLUIDO) return 5200;
  if (status === ProcessStatus.ANALISE) return 3400;
  if (status === ProcessStatus.TRIAGEM) return 2600;
  return 1800;
};

const toIsoDate = (value?: string): string => {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
};

const makeDataFromUsers = (users: User[]): ProcessRow[] => {
  const rows = users.map((user, idx) => ({
    id: user.protocol || `2026-${String(idx + 1).padStart(4, '0')}`,
    cliente: user.name,
    tipo: mapUnit(user.unit),
    responsavel: user.serviceManager || 'Não definido',
    dataInicio: toIsoDate(user.registrationDate),
    prazo: toIsoDate(user.deadline),
    status: mapProcessStatus(user.status, user.deadline),
    etapaAtual: user.notes ? 'Análise' : 'Documentos',
    financeiro: user.status === ProcessStatus.CONCLUIDO ? 'Pago' : 'Pendente',
    prioridade: mapPriority(user.status),
    valor: mapValue(user.status),
  }));

  return rows;
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDateBR = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
};

const sortCompare = (a: ProcessRow, b: ProcessRow, key: keyof ProcessRow, dir: 'asc' | 'desc') => {
  const av = a?.[key];
  const bv = b?.[key];
  if (key === 'dataInicio' || key === 'prazo') {
    const cmp = new Date(String(av)).getTime() - new Date(String(bv)).getTime();
    return dir === 'asc' ? cmp : -cmp;
  }
  if (key === 'valor') {
    const cmp = Number(av) - Number(bv);
    return dir === 'asc' ? cmp : -cmp;
  }
  const cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR');
  return dir === 'asc' ? cmp : -cmp;
};

const makePageWindow = (page: number, total: number): Array<number | '…'> => {
  if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: Array<number | '…'> = [1];
  const start = Math.max(2, page - 2);
  const end = Math.min(total - 1, page + 2);
  if (start > 2) pages.push('…');
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (end < total - 1) pages.push('…');
  pages.push(total);
  return pages;
};

const Chip: React.FC<{ tone?: string; children: React.ReactNode }> = ({ tone = 'neutral', children }) => (
  <span className={`chip chip--${tone}`}>{children}</span>
);

const IconButton: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => (
  <button className="iconBtn" type="button" title={title} onClick={onClick}>{children}</button>
);

interface ProcessosPageProps {
  users: User[];
}

const ProcessosPage: React.FC<ProcessosPageProps> = ({ users }) => {
  const data = useMemo(() => makeDataFromUsers(users), [users]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('TODOS');
  const [responsavel, setResponsavel] = useState('TODOS');
  const [tipo, setTipo] = useState('TODOS');
  const [periodo, setPeriodo] = useState('TODOS');
  const [sortKey, setSortKey] = useState<keyof ProcessRow>('prazo');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(() => {
    const obj: Record<string, boolean> = {};
    ALL_COLUMNS.forEach((c) => { obj[c.key] = true; });
    return obj;
  });
  const columnsPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!columnsOpen) return;
      const el = columnsPanelRef.current;
      if (el && !el.contains(e.target as Node)) setColumnsOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [columnsOpen]);

  const responsaveis = useMemo(() => Array.from(new Set(data.map((r) => r.responsavel))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [data]);
  const tipos = useMemo(() => Array.from(new Set(data.map((r) => r.tipo))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [data]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const now = new Date();
    const cutoffDays = periodo === '7D' ? 7 : periodo === '30D' ? 30 : periodo === '90D' ? 90 : null;

    return data.filter((r) => {
      if (term) {
        const hay = [r.id, r.cliente, r.tipo, r.responsavel, r.etapaAtual, STATUS[r.status].label, r.financeiro, PRIORIDADE[r.prioridade].label]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (status !== 'TODOS' && r.status !== status) return false;
      if (responsavel !== 'TODOS' && r.responsavel !== responsavel) return false;
      if (tipo !== 'TODOS' && r.tipo !== tipo) return false;

      if (cutoffDays != null) {
        const d = new Date(r.dataInicio);
        const diff = Math.abs(Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
        if (diff > cutoffDays) return false;
      }
      return true;
    });
  }, [data, q, status, responsavel, tipo, periodo]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => sortCompare(a, b, sortKey, sortDir)), [filtered, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  useEffect(() => {
    setPage((prev) => Math.max(1, Math.min(prev, totalPages)));
  }, [totalPages]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const stats = useMemo(() => ({
    total: filtered.length,
    ongoing: filtered.filter((r) => r.status === 'EM_ANDAMENTO').length,
    done: filtered.filter((r) => r.status === 'CONCLUIDO').length,
    pending: filtered.filter((r) => r.status === 'AGUARDANDO').length,
    late: filtered.filter((r) => r.status === 'ATRASADO').length,
  }), [filtered]);

  const visibleColumnsList = useMemo(() => ALL_COLUMNS.filter((c) => visibleCols[c.key]), [visibleCols]);

  const toggleSort = (key: keyof ProcessRow | '_actions') => {
    if (key === '_actions') return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };

  return (
    <div className="space-y-4">
      <style>{css}</style>
      <div className="topbar">
        <div className="titleRow">
          <div>
            <div className="title">Processos</div>
            <div className="subtitle">Visão geral em formato de planilha para filtrar, acompanhar status e agir rápido.</div>
          </div>
          <div className="topActions">
            <div className="columnsWrap" ref={columnsPanelRef}>
              <button className="btn btn--ghost" type="button" onClick={() => setColumnsOpen((v) => !v)}>☰ Colunas</button>
              {columnsOpen && (
                <div className="popover">
                  <div className="popoverHeader">
                    <div className="popoverTitle">Exibir colunas</div>
                  </div>
                  <div className="popoverBody">
                    {ALL_COLUMNS.map((c) => (
                      <label key={c.key} className="checkRow">
                        <input type="checkbox" checked={!!visibleCols[c.key]} onChange={() => setVisibleCols((prev) => ({ ...prev, [c.key]: !prev[c.key] }))} />
                        <span>{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="cards">
          <StatCard title="Processos" value={stats.total} hint="Total após filtros" tone="neutral" />
          <StatCard title="Em andamento" value={stats.ongoing} hint="Ativos" tone="success" />
          <StatCard title="Concluídos" value={stats.done} hint="Finalizados" tone="info" />
          <StatCard title="Aguardando" value={stats.pending} hint="Pendências" tone="warning" />
          <StatCard title="Atrasados" value={stats.late} hint="Prazo vencido" tone="danger" />
        </div>

        <div className="filters">
          <div className="field field--search">
            <span className="fieldIcon">⌕</span>
            <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Buscar processo, cliente, responsável, etapa..." />
          </div>
          <div className="field"><label className="label">Status</label><select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="TODOS">Todos</option>{Object.keys(STATUS).map((k) => <option key={k} value={k}>{STATUS[k as keyof typeof STATUS].label}</option>)}</select></div>
          <div className="field"><label className="label">Responsável</label><select className="select" value={responsavel} onChange={(e) => { setResponsavel(e.target.value); setPage(1); }}><option value="TODOS">Todos</option>{responsaveis.map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
          <div className="field"><label className="label">Tipo</label><select className="select" value={tipo} onChange={(e) => { setTipo(e.target.value); setPage(1); }}><option value="TODOS">Todos</option>{tipos.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="field"><label className="label">Período</label><select className="select" value={periodo} onChange={(e) => { setPeriodo(e.target.value); setPage(1); }}><option value="TODOS">Todos</option><option value="7D">Últimos 7 dias</option><option value="30D">Últimos 30 dias</option><option value="90D">Últimos 90 dias</option></select></div>
        </div>
      </div>

      <section className="tableCard">
        <div className="tableMeta">
          <div><div className="metaTitle">Lista de processos</div><div className="metaSub">Mostrando <b>{paged.length}</b> de <b>{sorted.length}</b> resultados</div></div>
          <div className="inlineField"><span className="inlineLabel">Linhas</span><select className="select select--sm" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>{[10, 15, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
        </div>

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>{visibleColumnsList.map((c) => (<th key={c.key} style={{ width: c.width }} className={c.key === '_actions' ? 'th th--actions' : 'th'}>{c.key === '_actions' ? c.label : <button className="thBtn" type="button" onClick={() => toggleSort(c.key as keyof ProcessRow)}><span>{c.label}</span><span className={`sort ${sortKey === c.key ? 'sort--active' : ''}`}>{sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span></button>}</th>))}</tr>
            </thead>
            <tbody>
              {paged.length === 0 ? <tr><td className="empty" colSpan={visibleColumnsList.length}>Nenhum processo encontrado com os filtros atuais.</td></tr> : paged.map((r) => (
                <tr key={r.id} className="tr">
                  {visibleCols.id && <td className="td td--mono">{r.id}</td>}
                  {visibleCols.cliente && <td className="td">{r.cliente}</td>}
                  {visibleCols.tipo && <td className="td">{r.tipo}</td>}
                  {visibleCols.responsavel && <td className="td">{r.responsavel}</td>}
                  {visibleCols.dataInicio && <td className="td">{formatDateBR(r.dataInicio)}</td>}
                  {visibleCols.prazo && <td className="td">{formatDateBR(r.prazo)}</td>}
                  {visibleCols.status && <td className="td"><Chip tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Chip></td>}
                  {visibleCols.etapaAtual && <td className="td">{r.etapaAtual}</td>}
                  {visibleCols.financeiro && <td className="td"><Chip tone={r.financeiro === 'Pago' ? 'success' : 'warning'}>{r.financeiro}</Chip></td>}
                  {visibleCols.prioridade && <td className="td"><Chip tone={PRIORIDADE[r.prioridade].tone}>{PRIORIDADE[r.prioridade].label}</Chip></td>}
                  {visibleCols.valor && <td className="td td--right">{formatBRL(r.valor)}</td>}
                  {visibleCols._actions && <td className="td td--actions"><IconButton title="Ver detalhes" onClick={() => window.alert(`Abrir detalhes do processo ${r.id}`)}>👁</IconButton><IconButton title="Editar" onClick={() => window.alert(`Editar processo ${r.id}`)}>✎</IconButton></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <div className="pagerLeft">Página <b>{page}</b> de <b>{totalPages}</b></div>
          <div className="pagerRight">
            <button className="btn btn--ghost btn--sm" type="button" disabled={page <= 1} onClick={() => setPage(1)}>«</button>
            <button className="btn btn--ghost btn--sm" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
            <div className="pageNumbers">{makePageWindow(page, totalPages).map((n, idx) => n === '…' ? <span className="dots" key={`d-${idx}`}>…</span> : <button key={n} className={`pageBtn ${n === page ? 'pageBtn--active' : ''}`} type="button" onClick={() => setPage(n)}>{n}</button>)}</div>
            <button className="btn btn--ghost btn--sm" type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próximo</button>
            <button className="btn btn--ghost btn--sm" type="button" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      </section>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: number; hint: string; tone?: string }> = ({ title, value, hint, tone = 'neutral' }) => (
  <div className={`card card--${tone}`}><div className="cardTitle">{title}</div><div className="cardValue">{value}</div><div className="cardHint">{hint}</div></div>
);

const css = `
  .topbar{background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:18px;backdrop-filter:blur(10px)}
  .titleRow{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.title{font-size:26px;font-weight:800}.subtitle{font-size:13px;color:rgba(255,255,255,.68)}
  .topActions{display:flex;gap:10px}.btn{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#fff;border-radius:12px;padding:8px 10px;cursor:pointer}.btn--sm{padding:6px 10px}
  .cards{margin-top:12px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
  .card{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);border-radius:14px;padding:10px}.cardTitle{font-size:12px;color:rgba(255,255,255,.68)}.cardValue{font-size:24px;font-weight:800}
  .filters{margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.1);display:grid;grid-template-columns:2fr repeat(4,1fr);gap:10px;align-items:end}
  .field{display:flex;flex-direction:column;gap:6px}.label{font-size:12px;color:rgba(255,255,255,.68)}.input,.select{height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;padding:0 10px}
  .field--search{position:relative}.fieldIcon{position:absolute;left:10px;top:50%;transform:translateY(-50%)}.field--search .input{padding-left:28px}
  .tableCard{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);border-radius:18px;overflow:hidden}.tableMeta{display:flex;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08)}
  .tableWrap{overflow:auto}.table{width:100%;border-collapse:separate;border-spacing:0;min-width:980px}.th,.td{padding:10px;border-bottom:1px solid rgba(255,255,255,.08)}.th{background:rgba(10,15,30,.65);position:sticky;top:0}.thBtn{display:flex;justify-content:space-between;width:100%;border:none;background:transparent;color:inherit}.td--right{text-align:right}.td--actions{text-align:right}.td--mono{font-family:monospace}
  .chip{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:12px;border:1px solid rgba(255,255,255,.14)}.chip--success{background:rgba(34,197,94,.2)}.chip--warning{background:rgba(245,158,11,.2)}.chip--danger{background:rgba(239,68,68,.2)}.chip--info{background:rgba(59,130,246,.2)}
  .iconBtn{width:32px;height:32px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;margin-left:6px;cursor:pointer}
  .empty{text-align:center;padding:20px;color:rgba(255,255,255,.7)}.pager{display:flex;justify-content:space-between;padding:10px 14px}.pagerRight{display:flex;gap:8px;align-items:center}.pageBtn{min-width:30px;height:30px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff}.pageBtn--active{background:rgba(99,102,241,.45)}
  .columnsWrap{position:relative}.popover{position:absolute;right:0;top:calc(100% + 8px);width:260px;background:rgba(10,15,30,.95);border:1px solid rgba(255,255,255,.14);border-radius:14px;z-index:40}.popoverHeader{padding:10px;border-bottom:1px solid rgba(255,255,255,.1)}.popoverBody{max-height:280px;overflow:auto;padding:10px}.checkRow{display:flex;gap:8px;padding:7px}
  @media (max-width:1100px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.filters{grid-template-columns:1fr 1fr}} @media (max-width:520px){.cards,.filters{grid-template-columns:1fr}}
`;

export default ProcessosPage;
