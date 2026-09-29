import { supabase } from '../../supabase';
import { PAYMENT_PROOFS_BUCKET, getSignedUrlMap } from './storage';

export type PaymentProof = {
  id: string;
  process_id: string;
  user_id: string;
  /** Caminho do objeto no bucket privado (registros antigos guardam a URL pública). */
  file_url: string;
  file_name: string | null;
  amount: number | null;
  notes: string | null;
  status: 'pending_validation' | 'validated' | 'rejected';
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
  /** URL assinada temporária resolvida na leitura; o bucket é privado. */
  signed_url?: string | null;
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
    .from(PAYMENT_PROOFS_BUCKET)
    .upload(filePath, file);

  if (uploadError) {
    return { error: `Erro ao fazer upload: ${uploadError.message}` };
  }

  const { data, error } = await supabase
    .from('payment_proofs')
    .insert({
      process_id: processId,
      user_id: userId,
      file_url: filePath,
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

  const [proof] = await withSignedUrls([data as PaymentProof]);
  return { proof };
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

  return withSignedUrls((data || []) as PaymentProof[]);
}

/** Resolve em lote as URLs assinadas dos comprovantes (bucket privado). */
async function withSignedUrls(proofs: PaymentProof[]): Promise<PaymentProof[]> {
  if (!proofs.length) return proofs;

  const signedUrls = await getSignedUrlMap(PAYMENT_PROOFS_BUCKET, proofs.map((proof) => proof.file_url));

  return proofs.map((proof) => ({
    ...proof,
    signed_url: signedUrls.get(proof.file_url) || null,
  }));
}
