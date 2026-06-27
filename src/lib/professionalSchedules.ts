import { supabase } from '../../supabase';

export type ScheduleSlot = {
  date: string;
  start_time: string;
  process_id?: string | null;
  protocolo?: string | null;
  cliente_nome?: string | null;
};

export async function listProfessionalSchedules(
  professionalId: string,
  startDate: string,
  endDate: string
): Promise<ScheduleSlot[]> {
  const { data, error } = await supabase
    .from('professional_schedules')
    .select('date, start_time, process_id')
    .eq('professional_id', professionalId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('start_time');

  if (error) {
    console.error('[professionalSchedules] list error:', error);
    return [];
  }

  const slots: ScheduleSlot[] = (data || []).map((s) => ({
    date: s.date,
    start_time: s.start_time,
    process_id: s.process_id,
  }));

  const processIds = slots.filter((s) => s.process_id).map((s) => s.process_id!);
  if (processIds.length > 0) {
    const { data: processes } = await supabase
      .from('processes')
      .select('id, protocolo, cliente_nome')
      .in('id', [...new Set(processIds)]);

    const processMap = new Map((processes || []).map((p) => [p.id, p]));
    for (const slot of slots) {
      if (slot.process_id) {
        const proc = processMap.get(slot.process_id);
        if (proc) {
          slot.protocolo = proc.protocolo;
          slot.cliente_nome = proc.cliente_nome;
        }
      }
    }
  }

  return slots;
}

export async function toggleSlotProcessLink(
  professionalId: string,
  date: string,
  start_time: string,
  processId: string | null
): Promise<boolean> {
  if (processId) {
    const { error } = await supabase
      .from('professional_schedules')
      .upsert(
        { professional_id: professionalId, date, start_time, process_id: processId },
        { onConflict: 'professional_id,date,start_time' }
      );
    if (error) {
      console.error('[professionalSchedules] link error:', error);
      return false;
    }
  } else {
    const { error } = await supabase
      .from('professional_schedules')
      .update({ process_id: null })
      .eq('professional_id', professionalId)
      .eq('date', date)
      .eq('start_time', start_time);
    if (error) {
      console.error('[professionalSchedules] unlink error:', error);
      return false;
    }
  }
  return true;
}

export async function upsertScheduleSlots(
  professionalId: string,
  slots: { date: string; start_time: string }[]
): Promise<boolean> {
  if (slots.length === 0) return true;

  const rows = slots.map((s) => ({
    professional_id: professionalId,
    date: s.date,
    start_time: s.start_time,
  }));

  const { error } = await supabase
    .from('professional_schedules')
    .upsert(rows, { onConflict: 'professional_id,date,start_time' });

  if (error) {
    console.error('[professionalSchedules] upsert error:', error);
    return false;
  }
  return true;
}

export async function deleteScheduleSlots(
  professionalId: string,
  slots: { date: string; start_time: string }[]
): Promise<boolean> {
  if (slots.length === 0) return true;

  const orConditions = slots
    .map((s) => `and(date.eq.${s.date},start_time.eq.${s.start_time})`)
    .join(',');

  const { error } = await supabase
    .from('professional_schedules')
    .delete()
    .eq('professional_id', professionalId)
    .or(orConditions);

  if (error) {
    console.error('[professionalSchedules] delete error:', error);
    return false;
  }
  return true;
}

export async function getProfessionals(): Promise<
  { id: string; nome_completo: string; email: string }[]
> {
  const { data: defaultOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'default')
    .single();

  if (!defaultOrg) return [];

  const { data: members, error } = await supabase
    .from('org_members')
    .select('user_id')
    .eq('org_id', defaultOrg.id)
    .neq('role', 'client');

  if (error) {
    console.error('[professionalSchedules] getProfessionals error:', error);
    return [];
  }

  const userIds = [...new Set((members || []).map((m) => m.user_id))];
  if (userIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, nome_completo, email')
    .in('id', userIds);

  if (profileError) {
    console.error('[professionalSchedules] getProfessionals profile error:', profileError);
    return [];
  }

  return (profiles || []).map((p) => ({
    id: p.id,
    nome_completo: p.nome_completo || p.email || 'Sem nome',
    email: p.email || '',
  }));
}

export async function getProcessesForProfessional(
  professionalId: string
): Promise<{ id: string; protocolo: string; cliente_nome: string }[]> {
  const { data, error } = await supabase
    .from('processes')
    .select('id, protocolo, cliente_nome')
    .eq('responsavel_user_id', professionalId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[professionalSchedules] getProcessesForProfessional error:', error);
    return [];
  }
  return data || [];
}
