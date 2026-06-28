import { supabase } from '../../supabase';

export type ProcessMessage = {
  id: string;
  process_id: string;
  sender_id: string;
  message: string;
  attachments: { name: string; url: string; size: number }[];
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

  return (data || []).map((m) => ({
    ...m,
    attachments: m.attachments || [],
    sender_name: nameMap.get(m.sender_id) || 'Usuário',
  }));
}

export async function sendMessage(
  processId: string,
  senderId: string,
  message: string,
  attachments?: { name: string; url: string; size: number }[]
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

  return { ...data, sender_name: undefined };
}

export async function uploadMessageAttachment(
  processId: string,
  file: File
): Promise<{ name: string; url: string; size: number } | null> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${processId}/comunicacao/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from('process_documents')
    .upload(path, file);

  if (error) {
    console.error('[processMessages] upload error:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('process_documents')
    .getPublicUrl(path);

  return {
    name: file.name,
    url: urlData?.publicUrl || '',
    size: file.size,
  };
}
