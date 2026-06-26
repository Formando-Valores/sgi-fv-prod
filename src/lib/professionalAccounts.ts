import { supabase } from '../supabase';
import type { ServiceUnit } from '../../types';

export type ProfessionalAccount = {
  id: string;
  user_id: string;
  full_name: string;
  document: string | null;
  iban: string;
  bank_name: string | null;
  service_unit: ServiceUnit;
  is_active: boolean;
  stripe_connect_account_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function listProfessionalAccounts(): Promise<ProfessionalAccount[]> {
  const { data, error } = await supabase
    .from('professional_payment_accounts')
    .select('*')
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Erro ao listar contas profissionais:', error);
    return [];
  }
  return (data || []) as ProfessionalAccount[];
}

export async function upsertProfessionalAccount(
  account: {
    user_id?: string;
    full_name: string;
    document?: string;
    iban: string;
    bank_name?: string;
    service_unit: ServiceUnit;
    is_active?: boolean;
  },
): Promise<{ data?: ProfessionalAccount; error?: string }> {
  const { data, error } = await supabase
    .from('professional_payment_accounts')
    .upsert(account, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    return { error: `Erro ao salvar conta: ${error.message}` };
  }
  return { data: data as ProfessionalAccount };
}

export async function deleteProfessionalAccount(id: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('professional_payment_accounts')
    .delete()
    .eq('id', id);

  if (error) {
    return { error: `Erro ao excluir conta: ${error.message}` };
  }
  return {};
}
