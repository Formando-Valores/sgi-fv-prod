import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Check, X, Briefcase } from 'lucide-react';
import {
  listProfessionalSchedules,
  upsertScheduleSlots,
  deleteScheduleSlots,
  toggleSlotProcessLink,
  getProfessionals,
  getProcessesForProfessional,
} from '../../../lib/professionalSchedules';
import type { ScheduleSlot } from '../../../lib/professionalSchedules';

const TIME_SLOTS_BR = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30'];
const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

type SlotInfo = {
  process_id?: string | null;
  protocolo?: string | null;
  cliente_nome?: string | null;
};

type ViewMode = 'day' | 'week' | 'month';

function getMondayOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

const AgendaBlock: React.FC = () => {
  const now = new Date();
  const [professionals, setProfessionals] = useState<{ id: string; nome_completo: string }[]>([]);
  const [selectedProf, setSelectedProf] = useState<string>('');
  const [scheduleMap, setScheduleMap] = useState<Map<string, SlotInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [linkModal, setLinkModal] = useState<{ date: string; time: string } | null>(null);
  const [availableProcesses, setAvailableProcesses] = useState<{ id: string; protocolo: string; cliente_nome: string }[]>([]);
  const [linking, setLinking] = useState(false);

  const [view, setView] = useState<ViewMode>('week');
  const [referenceDate, setReferenceDate] = useState<Date>(getMondayOfWeek(now));

  const selectedTimeSlots = TIME_SLOTS_BR;

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const key = (date: string, time: string) => `${date}|${time}`;

  const getDays = useCallback(() => {
    const days: Date[] = [];
    if (view === 'day') {
      const d = new Date(referenceDate);
      const dow = d.getDay();
      if (dow >= 1 && dow <= 5) days.push(d);
    } else if (view === 'week') {
      const mon = new Date(referenceDate);
      for (let i = 0; i < 7; i++) {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        days.push(d);
      }
    } else {
      const firstDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
      const lastDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
      for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (dow >= 1 && dow <= 5) days.push(new Date(d));
      }
    }
    return days;
  }, [view, referenceDate]);

  useEffect(() => {
    getProfessionals().then((list) => {
      setProfessionals(list);
      if (list.length > 0 && !selectedProf) setSelectedProf(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedProf) return;
    setLoading(true);
    const days = getDays();
    if (days.length === 0) { setLoading(false); setScheduleMap(new Map()); return; }
    const startDate = formatDate(days[0]);
    const endDate = formatDate(days[days.length - 1]);

    listProfessionalSchedules(selectedProf, startDate, endDate).then((slots) => {
      const map_ = new Map<string, SlotInfo>();
      slots.forEach((s) => map_.set(key(s.date, s.start_time), {
        process_id: s.process_id,
        protocolo: s.protocolo,
        cliente_nome: s.cliente_nome,
      }));
      setScheduleMap(map_);
      setLoading(false);
    });
  }, [selectedProf, view, referenceDate, getDays]);

  const handleSlotClick = async (date: string, time: string) => {
    if (!selectedProf) return;
    const k = key(date, time);
    const slot = scheduleMap.get(k);

    if (slot?.process_id) {
      setSaving(k);
      const ok = await toggleSlotProcessLink(selectedProf, date, time, null);
      if (ok) {
        setScheduleMap((prev) => {
          const next = new Map(prev);
          if (next.has(k)) next.set(k, {});
          else next.delete(k);
          return next;
        });
      }
      setSaving(null);
    } else if (scheduleMap.has(k)) {
      const procs = await getProcessesForProfessional(selectedProf);
      const unlinked = procs.filter((p) => {
        for (const [, v] of scheduleMap) {
          if (v.process_id === p.id) return false;
        }
        return true;
      });
      setAvailableProcesses(unlinked);
      setLinkModal({ date, time });
    } else {
      setSaving(k);
      const ok = await upsertScheduleSlots(selectedProf, [{ date, start_time: time }]);
      if (ok) {
        setScheduleMap((prev) => {
          const next = new Map(prev);
          next.set(k, {});
          return next;
        });
      }
      setSaving(null);
    }
  };

  const confirmLink = async (processId: string) => {
    if (!linkModal || !selectedProf) return;
    setLinking(true);
    const ok = await toggleSlotProcessLink(selectedProf, linkModal.date, linkModal.time, processId);
    if (ok) {
      const k = key(linkModal.date, linkModal.time);
      const proc = availableProcesses.find((p) => p.id === processId);
      setScheduleMap((prev) => {
        const next = new Map(prev);
        next.set(k, { process_id: processId, protocolo: proc?.protocolo, cliente_nome: proc?.cliente_nome });
        return next;
      });
    }
    setLinking(false);
    setLinkModal(null);
    setAvailableProcesses([]);
  };

  const navigate = (dir: -1 | 1) => {
    const d = new Date(referenceDate);
    if (view === 'day') {
      d.setDate(d.getDate() + dir);
    } else if (view === 'week') {
      d.setDate(d.getDate() + 7 * dir);
    } else {
      d.setMonth(d.getMonth() + dir);
    }
    setReferenceDate(d);
  };

  const goToday = () => {
    const today = new Date();
    if (view === 'week') setReferenceDate(getMondayOfWeek(today));
    else if (view === 'day') setReferenceDate(today);
    else setReferenceDate(today);
  };

  const handleViewChange = (newView: ViewMode) => {
    const today = new Date();
    if (newView === 'week') setReferenceDate(getMondayOfWeek(today));
    else if (newView === 'day') setReferenceDate(today);
    else setReferenceDate(today);
    setView(newView);
  };

  const renderTitle = () => {
    if (view === 'day') {
      const d = referenceDate;
      return `${WEEKDAY_FULL[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }
    if (view === 'week') {
      const mon = referenceDate;
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return `Semana de ${mon.getDate()} ${MONTHS[mon.getMonth()]} a ${sun.getDate()} ${MONTHS[sun.getMonth()]} ${mon.getFullYear()}`;
    }
    return `${MONTHS[referenceDate.getMonth()]} ${referenceDate.getFullYear()}`;
  };

  const days = getDays();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-lg font-black uppercase tracking-wider">Agenda de Trabalho</h2>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-bold">
            {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => handleViewChange(v)}
                className={`px-3 py-1.5 rounded-md transition-all uppercase tracking-wider ${
                  view === v ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
          <select
            value={selectedProf}
            onChange={(e) => setSelectedProf(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold"
          >
            <option value="">Selecione um profissional</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>{p.nome_completo}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="font-bold text-sm min-w-[180px] text-center whitespace-nowrap">
              {renderTitle()}
            </span>
            <button onClick={() => navigate(1)} className="p-2 rounded-lg hover:bg-gray-100">
              <ChevronRight className="h-5 w-5" />
            </button>
            <button
              onClick={goToday}
              className="ml-1 px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
            >
              Hoje
            </button>
          </div>
        </div>
      </div>

      {!selectedProf ? (
        <p className="text-gray-500 text-center py-12 font-semibold">Selecione um profissional para ver a agenda.</p>
      ) : loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : days.length === 0 ? (
        <p className="text-gray-500 text-center py-12 font-semibold">Nenhum dia útil neste período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white z-10 p-2 text-left font-black text-gray-500 uppercase tracking-wider min-w-[60px]">Horário</th>
                {days.map((d, i) => (
                  <th key={i} className="p-2 text-center font-black text-gray-500 uppercase tracking-wider min-w-[100px]">
                    <div>{view === 'day' ? '' : WEEKDAY_SHORT[d.getDay()]}</div>
                    <div className="text-sm text-gray-800">{d.getDate()}/{d.getMonth() + 1}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedTimeSlots.map((time) => (
                <tr key={time} className="border-t border-gray-100">
                  <td className="sticky left-0 bg-white z-10 p-2 font-semibold text-gray-600 whitespace-nowrap">{time}</td>
                  {days.map((d, i) => {
                    const dateStr = formatDate(d);
                    const k = key(dateStr, time);
                    const slot = scheduleMap.get(k);
                    const isSaving = saving === k;

                    let bgClass = 'bg-gray-50 hover:bg-gray-100';
                    let content: React.ReactNode = <X className="h-3 w-3 text-gray-300" />;
                    let title = 'Indisponível';

                    if (slot?.process_id) {
                      bgClass = 'bg-sky-100 hover:bg-sky-200';
                      content = (
                        <span className="text-[10px] font-bold text-sky-800 leading-tight truncate max-w-[90px] block">
                          {slot.protocolo || 'Processo'}
                        </span>
                      );
                      title = `${slot.protocolo || 'Processo'} — ${slot.cliente_nome || ''}`;
                    } else if (scheduleMap.has(k)) {
                      bgClass = 'bg-emerald-100 hover:bg-emerald-200';
                      content = <Check className="h-3 w-3 text-emerald-600" />;
                      title = 'Disponível (clique para vincular processo)';
                    }

                    return (
                      <td key={i} className="p-1">
                        <button
                          onClick={() => handleSlotClick(dateStr, time)}
                          disabled={!!saving}
                          title={title}
                          className={`w-full h-10 rounded-lg flex items-center justify-center transition-all ${bgClass} ${isSaving ? 'opacity-50' : ''}`}
                        >
                          {isSaving ? (
                            <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                          ) : content}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 inline-block border border-emerald-300" /> Disponível</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-100 inline-block border border-sky-300" /> Com processo</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-50 inline-block border border-gray-200" /> Indisponível</span>
      </div>

      {linkModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { if (!linking) setLinkModal(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black uppercase tracking-wider mb-4">Vincular Processo</h3>
            <p className="text-sm text-gray-600 mb-4">
              Horário: <strong>{linkModal.date}</strong> às <strong>{linkModal.time}</strong>
            </p>
            {availableProcesses.length === 0 ? (
              <p className="text-sm text-gray-500 mb-4">Nenhum processo disponível para este profissional.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {availableProcesses.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => confirmLink(p.id)}
                    disabled={linking}
                    className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-sky-300 hover:bg-sky-50 transition-all flex items-center gap-3 disabled:opacity-50"
                  >
                    <Briefcase className="h-4 w-4 text-sky-600 flex-shrink-0" />
                    <div>
                      <div className="font-bold text-sm text-gray-800">{p.protocolo}</div>
                      <div className="text-xs text-gray-500">{p.cliente_nome}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              {linking && <Loader2 className="h-4 w-4 animate-spin text-sky-600" />}
              <button
                onClick={() => setLinkModal(null)}
                disabled={linking}
                className="px-4 py-2 text-sm font-bold rounded-lg bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgendaBlock;
