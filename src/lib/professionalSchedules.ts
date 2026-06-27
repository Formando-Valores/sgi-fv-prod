import { supabase } from '../../supabase';

export type ProfessionalSchedule = {
  id: string;
  professional_id: string;
  date: string;
  start_time: string;
  created_at: string;
  updated_at: string;
};

export type ScheduleSlot = {
  date: string;
  start_time: string;
};

export async function listProfessionalSchedules(
  professionalId: string,
  startDate: string,
  endDate: string
): Promise<ScheduleSlot[]> {
  const { data, error } = await supabase
    .from('professional_schedules')
    .select('date, start_time')
    .eq('professional_id', professionalId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('start_time');

  if (error) {
    console.error('[professionalSchedules] list error:', error);
    return [];
  }
  return data || [];
}

export async function listAllSchedules(
  startDate: string,
  endDate: string
): Promise<{ professional_id: string; date: string; start_time: string }[]> {
  const { data, error } = await supabase
    .from('professional_schedules')
    .select('professional_id, date, start_time')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('start_time');

  if (error) {
    console.error('[professionalSchedules] listAll error:', error);
    return [];
  }
  return data || [];
}

export async function upsertScheduleSlots(
  professionalId: string,
  slots: ScheduleSlot[]
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
  slots: ScheduleSlot[]
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
