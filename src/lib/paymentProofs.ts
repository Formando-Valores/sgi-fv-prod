import { supabase } from '../../supabase';

export type PaymentProof = {
  id: string;
  process_id: string;
  user_id: string;
  file_url: string;
  file_name: string | null;
  amount: number | null;
  notes: string | null;
  status: 'pending_validation' | 'validated' | 'rejected';
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
};

export async function uploadPaymentProof(
  processId: string,
  userId: string,
  file: File,
  amount?: number,
  notes?: string,
): Promise<{ proof?: PaymentProof; error?: string }> {
  const filePath = `${userId}/${processId}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('payment_proofs')
    .upload(filePath, file);

  if (uploadError) {
    return { error: `Erro ao fazer upload: ${uploadError.message}` };
  }

  const { data: urlData } = supabase.storage.from('payment_proofs').getPublicUrl(filePath);
  const fileUrl = urlData?.publicUrl || '';

  const { data, error } = await supabase
    .from('payment_proofs')
    .insert({
      process_id: processId,
      user_id: userId,
      file_url: fileUrl,
      file_name: file.name,
      amount: amount ?? null,
      notes: notes ?? null,
      status: 'pending_validation',
    })
    .select()
    .single();

  if (error) {
    return { error: `Erro ao registrar comprovante: ${error.message}` };
  }

  // Update process payment_status to pending_validation
  await supabase
    .from('processes')
    .update({ payment_status: 'pending_validation' })
    .eq('id', processId);

  return { proof: data as PaymentProof };
}

export async function validatePaymentProof(
  proofId: string,
  processId: string,
  status: 'validated' | 'rejected',
  adminUserId: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('payment_proofs')
    .update({
      status,
      validated_by: adminUserId,
      validated_at: new Date().toISOString(),
    })
    .eq('id', proofId);

  if (error) {
    return { error: `Erro ao atualizar comprovante: ${error.message}` };
  }

  if (status === 'validated') {
    await supabase
      .from('processes')
      .update({ payment_status: 'validated' })
      .eq('id', processId);
  } else {
    await supabase
      .from('processes')
      .update({ payment_status: 'rejected' })
      .eq('id', processId);
  }

  return {};
}

export async function getPaymentProofs(processId: string): Promise<PaymentProof[]> {
  const { data, error } = await supabase
    .from('payment_proofs')
    .select('*')
    .eq('process_id', processId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching payment proofs:', error);
    return [];
  }

  return (data || []) as PaymentProof[];
}
