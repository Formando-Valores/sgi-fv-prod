import { supabase } from '../../supabase';
import { addProcessAttachment } from './processes';

const BUCKET = 'process_documents';

export type ProcessDocument = {
  id: string;
  org_id: string;
  process_id: string;
  document_name: string;
  file_path: string;
  file_type: string | null;
  validation_status: 'pending' | 'approved' | 'rejected' | 'resubmission_requested';
  uploaded_by: string;
  pending_reason: string | null;
  review_notes: string | null;
  guidance: string | null;
  created_at: string;
};

export async function uploadProcessDocument(
  orgId: string,
  processId: string,
  userId: string,
  file: File,
  documentName?: string,
): Promise<{ document?: ProcessDocument; error?: string }> {
  const name = documentName || file.name;
  const filePath = `${orgId}/${processId}/${userId}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file);

  if (uploadError) {
    return { error: `Erro ao fazer upload: ${uploadError.message}` };
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  const publicUrl = urlData?.publicUrl || '';

  try {
    await addProcessAttachment(
      orgId,
      processId,
      {
        document_name: name,
        file_path: publicUrl,
        file_type: file.type || null,
        pending_reason: 'Aguardando validação documental',
      },
      userId,
    );
  } catch (err: any) {
    await supabase.storage.from(BUCKET).remove([filePath]);
    return { error: `Erro ao registrar documento: ${err?.message || 'desconhecido'}` };
  }

  const { data, error } = await supabase
    .from('process_document_attachments')
    .select('*')
    .eq('file_path', publicUrl)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data?.length) {
    return { error: 'Documento enviado mas não foi possível confirmar o registro.' };
  }

  return { document: data[0] as ProcessDocument };
}

export async function listProcessDocuments(
  processId: string,
): Promise<ProcessDocument[]> {
  const { data, error } = await supabase
    .from('process_document_attachments')
    .select('*')
    .eq('process_id', processId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing process documents:', error);
    return [];
  }

  return (data || []) as ProcessDocument[];
}

export async function deleteProcessDocument(
  docId: string,
  filePath: string,
): Promise<{ error?: string }> {
  const { error: dbError } = await supabase
    .from('process_document_attachments')
    .delete()
    .eq('id', docId);

  if (dbError) {
    return { error: `Erro ao remover registro: ${dbError.message}` };
  }

  const fileName = filePath.split('/').pop();
  if (fileName) {
    await supabase.storage.from(BUCKET).remove([fileName]);
  }

  return {};
}

export async function reviewProcessDocument(
  docId: string,
  decision: 'approved' | 'rejected' | 'resubmission_requested',
  reviewerUserId: string,
  options?: { justification?: string; guidance?: string },
): Promise<{ error?: string }> {
  const update: Record<string, any> = {
    validation_status: decision,
    reviewer_user_id: reviewerUserId,
    reviewed_at: new Date().toISOString(),
  };

  if (options?.justification) update.review_notes = options.justification;
  if (options?.guidance) update.guidance = options.guidance;

  const { error } = await supabase
    .from('process_document_attachments')
    .update(update)
    .eq('id', docId);

  if (error) {
    return { error: `Erro ao revisar documento: ${error.message}` };
  }

  return {};
}
