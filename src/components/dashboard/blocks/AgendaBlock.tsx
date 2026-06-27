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
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKDAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

type SlotInfo = {
  process_id?: string | null;
  protocolo?: string | null;
  cliente_nome?: string | null;
};

const AgendaBlock: React.FC = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [professionals, setProfessionals] = useState<{ id: string; nome_completo: string }[]>([]);
  const [selectedProf, setSelectedProf] = useState<string>('');
  const [scheduleMap, setScheduleMap] = useState<Map<string, SlotInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [linkModal, setLinkModal] = useState<{ date: string; time: string } | null>(null);
  const [availableProcesses, setAvailableProcesses] = useState<{ id: string; protocolo: string; cliente_nome: string }[]>([]);
  const [linking, setLinking] = useState(false);

  const selectedTimeSlots = TIME_SLOTS_BR;

  const getDaysInMonth = useCallback(() => {
    const days: Date[] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    for (let d = firstDay; d <= lastDay; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        days.push(new Date(d));
      }
    }
    return days;
  }, [year, month]);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  const key = (date: string, time: string) => `${date}|${time}`;

  useEffect(() => {
    getProfessionals().then((list) => {
      setProfessionals(list);
      if (list.length > 0 && !selectedProf) setSelectedProf(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedProf) return;
    setLoading(true);
    const days = getDaysInMonth();
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
  }, [selectedProf, year, month, getDaysInMonth]);

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

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  const days = getDaysInMonth();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-black uppercase tracking-wider">Agenda de Trabalho</h2>
        <div className="flex items-center gap-3">
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
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="font-bold text-sm min-w-[160px] text-center">
              {MONTHS[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {!selectedProf ? (
        <p className="text-gray-500 text-center py-12 font-semibold">Selecione um profissional para ver a agenda.</p>
      ) : loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white z-10 p-2 text-left font-black text-gray-500 uppercase tracking-wider min-w-[60px]">Horário</th>
                {days.map((d, i) => (
                  <th key={i} className="p-2 text-center font-black text-gray-500 uppercase tracking-wider min-w-[100px]">
                    <div>{WEEKDAY_NAMES[d.getDay() - 1]}</div>
                    <div className="text-sm text-gray-800">{d.getDate()}</div>
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
        <span className="text-gray-400">| Clique para alternar</span>
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
