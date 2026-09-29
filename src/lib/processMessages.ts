import { supabase } from '../../supabase';
import { PROCESS_DOCUMENTS_BUCKET, getSignedUrlMap } from './storage';

export type ProcessMessageAttachment = {
  name: string;
  /** Caminho do objeto no bucket privado (registros antigos guardam a URL pública). */
  url: string;
  size: number;
  /** URL assinada temporária resolvida na leitura; o bucket é privado. */
  signedUrl?: string | null;
};

export type ProcessMessage = {
  id: string;
  process_id: string;
  sender_id: string;
  message: string;
  attachments: ProcessMessageAttachment[];
  created_at: string;
  sender_name?: string;
};

export async function listMessages(processId: string): Promise<ProcessMessage[]> {
  const { data, error } = await supabase
    .from('process_messages')
    .select('*')
    .eq('process_id', processId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[processMessages] list error:', error);
    return [];
  }

  const senderIds = [...new Set((data || []).map((m) => m.sender_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nome_completo')
    .in('id', senderIds);

  const nameMap = new Map((profiles || []).map((p) => [p.id, p.nome_completo || 'Usuário']));

  return withSignedAttachments(
    (data || []).map((m) => ({
      ...m,
      attachments: (m.attachments || []) as ProcessMessageAttachment[],
      sender_name: nameMap.get(m.sender_id) || 'Usuário',
    })),
  );
}

/** Resolve em lote as URLs assinadas dos anexos (bucket privado). */
async function withSignedAttachments(messages: ProcessMessage[]): Promise<ProcessMessage[]> {
  const stored = messages.flatMap((m) => (m.attachments || []).map((att) => att.url));
  if (!stored.length) return messages;

  const signedUrls = await getSignedUrlMap(PROCESS_DOCUMENTS_BUCKET, stored);

  return messages.map((message) => ({
    ...message,
    attachments: (message.attachments || []).map((att) => ({
      ...att,
      signedUrl: signedUrls.get(att.url) || null,
    })),
  }));
}

export async function sendMessage(
  processId: string,
  senderId: string,
  message: string,
  attachments?: ProcessMessageAttachment[]
): Promise<ProcessMessage | null> {
  const { data, error } = await supabase
    .from('process_messages')
    .insert({
      process_id: processId,
      sender_id: senderId,
      message,
      attachments: attachments || [],
    })
    .select()
    .single();

  if (error) {
    console.error('[processMessages] send error:', error);
    return null;
  }

  const [enriched] = await withSignedAttachments([{ ...data, sender_name: undefined } as ProcessMessage]);
  return enriched;
}

export async function uploadMessageAttachment(
  processId: string,
  file: File
): Promise<ProcessMessageAttachment | null> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${processId}/comunicacao/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(PROCESS_DOCUMENTS_BUCKET)
    .upload(path, file);

  if (error) {
    console.error('[processMessages] upload error:', error);
    return null;
  }

  return {
    name: file.name,
    url: path,
    size: file.size,
  };
}
