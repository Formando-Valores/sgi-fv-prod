import { supabase } from '../../supabase';

export type PendingPaymentRow = {
  id: string;
  process_id: string;
  status: string;
  amount: number;
  currency: string;
  created_at: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  process: { protocolo: string | null; titulo: string | null; org_id: string } | null;
};

export async function listPendingPaymentsForReconciliation(minAgeMinutes = 10, limit = 30) {
  const cutoff = new Date(Date.now() - minAgeMinutes * 60_000).toISOString();
  const { data, error } = await supabase
    .from('payments')
    .select('id, process_id, status, amount, currency, created_at, stripe_checkout_session_id, stripe_payment_intent_id, process:processes(protocolo,titulo,org_id)')
    .eq('status', 'pending')
    .lte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as PendingPaymentRow[];
}
