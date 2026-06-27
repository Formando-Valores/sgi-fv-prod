import React, { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Check, X } from 'lucide-react';
import { supabase } from '../../../../supabase';
import {
  listProfessionalSchedules,
  upsertScheduleSlots,
  deleteScheduleSlots,
  getProfessionals,
} from '../../../lib/professionalSchedules';
import type { ScheduleSlot } from '../../../lib/professionalSchedules';

const TIME_SLOTS_BR = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30'];
const TIME_SLOTS_PT = ['13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30'];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKDAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const AgendaBlock: React.FC = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [professionals, setProfessionals] = useState<{ id: string; nome_completo: string }[]>([]);
  const [selectedProf, setSelectedProf] = useState<string>('');
  const [schedules, setSchedules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

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
      const set_ = new Set<string>();
      slots.forEach((s) => set_.add(key(s.date, s.start_time)));
      setSchedules(set_);
      setLoading(false);
    });
  }, [selectedProf, year, month, getDaysInMonth]);

  const toggleSlot = async (date: string, time: string) => {
    if (!selectedProf) return;
    const k = key(date, time);
    const isAvailable = schedules.has(k);
    setToggling(k);
    setSaving(true);

    let ok: boolean;
    if (isAvailable) {
      ok = await deleteScheduleSlots(selectedProf, [{ date, start_time: time }]);
    } else {
      ok = await upsertScheduleSlots(selectedProf, [{ date, start_time: time }]);
    }

    if (ok) {
      setSchedules((prev) => {
        const next = new Set(prev);
        if (isAvailable) next.delete(k);
        else next.add(k);
        return next;
      });
    }
    setSaving(false);
    setToggling(null);
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
                  <th key={i} className="p-2 text-center font-black text-gray-500 uppercase tracking-wider min-w-[80px]">
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
                    const isAvailable = schedules.has(k);
                    const isToggling = toggling === k;
                    return (
                      <td key={i} className="p-1">
                        <button
                          onClick={() => toggleSlot(dateStr, time)}
                          disabled={saving && isToggling}
                          className={`w-full h-8 rounded-lg flex items-center justify-center transition-all text-xs font-bold ${
                            isAvailable
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-gray-50 text-gray-300 hover:bg-gray-100'
                          } ${isToggling ? 'opacity-50' : ''}`}
                        >
                          {isToggling ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : isAvailable ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
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
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 inline-block" /> Disponível</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-50 inline-block border border-gray-200" /> Indisponível</span>
        <span className="text-gray-400">| Clique no horário para alternar disponibilidade</span>
      </div>
    </div>
  );
};

export default AgendaBlock;
