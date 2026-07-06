import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Send, Paperclip, Loader2, FileText, Image, X, Printer } from 'lucide-react';
import { supabase } from '../../../../supabase';
import { listMessages, sendMessage, uploadMessageAttachment, type ProcessMessage } from '../../../lib/processMessages';

type Props = {
  processId: string;
  currentUserId: string;
  dark?: boolean;
};

const CommunicationBlock: React.FC<Props> = ({ processId, currentUserId, dark }) => {
  const [messages, setMessages] = useState<ProcessMessage[]>([]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const msgs = await listMessages(processId);
    setMessages(msgs);
    setLoading(false);
  };

  useEffect(() => { load(); }, [processId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() && files.length === 0) return;
    setSending(true);

    let attachments: { name: string; url: string; size: number }[] = [];
    if (files.length > 0) {
      const uploaded = await Promise.all(
        files.map((f) => uploadMessageAttachment(processId, f))
      );
      attachments = uploaded.filter(Boolean) as { name: string; url: string; size: number }[];
    }

    const sent = await sendMessage(processId, currentUserId, text.trim(), attachments);
    if (sent) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome_completo')
        .eq('id', currentUserId)
        .single();
      setMessages((prev) => [...prev, { ...sent, sender_name: profile?.nome_completo || 'Você' }]);
      setText('');
      setFiles([]);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const fileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '')) return <Image className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const generateReport = useCallback(async () => {
    setReportLoading(true);
    const msgs = messages.length > 0 ? messages : await listMessages(processId);
    setReportLoading(false);

    const formatDate = (ts: string) => {
      const d = new Date(ts);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const reportHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Relatório de Comunicação</title>
<style>
  @page { margin: 2cm; }
  body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
  h1 { color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; font-size: 20px; }
  .header-info { margin-bottom: 24px; padding: 12px; background: #f8fafc; border-radius: 6px; font-size: 13px; }
  .header-info strong { display: inline-block; min-width: 100px; }
  .msg { margin-bottom: 12px; padding: 10px 14px; border-radius: 8px; page-break-inside: avoid; }
  .msg-client { background: #eff6ff; border-left: 3px solid #2563eb; }
  .msg-staff { background: #f8fafc; border-left: 3px solid #94a3b8; }
  .msg-header { font-size: 12px; color: #64748b; margin-bottom: 4px; }
  .msg-author { font-weight: bold; color: #1e293b; }
  .msg-text { font-size: 14px; margin: 4px 0; white-space: pre-wrap; }
  .msg-attach { font-size: 12px; color: #2563eb; margin-top: 4px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
</style></head><body>
<h1>Relatório de Comunicação</h1>
<div class="header-info">
  <strong>Processo:</strong> ${processId}<br>
  <strong>Período:</strong> ${msgs.length > 0 ? formatDate(msgs[0].created_at) + ' até ' + formatDate(msgs[msgs.length - 1].created_at) : 'N/A'}<br>
  <strong>Total de mensagens:</strong> ${msgs.length}
</div>
${msgs.map(msg => `
<div class="msg ${msg.sender_id === currentUserId ? 'msg-staff' : 'msg-client'}">
  <div class="msg-header"><span class="msg-author">${msg.sender_name || 'Desconhecido'}</span> &mdash; ${formatDate(msg.created_at)}</div>
  <div class="msg-text">${msg.message}</div>
  ${msg.attachments?.length ? `<div class="msg-attach">📎 ${msg.attachments.map(a => a.name).join(', ')}</div>` : ''}
</div>`).join('')}
<div class="footer">Relatório gerado pelo SGI FV em ${new Date().toLocaleString('pt-BR')}</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(reportHtml);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 500);
    }
  }, [messages, processId, currentUserId]);

  return (
    <div className="flex flex-col h-[500px]">
      <div className={`flex items-center justify-between px-4 py-2 border-b ${dark ? 'border-slate-600' : 'border-gray-100'}`}>
        <h3 className={`text-sm font-bold ${dark ? 'text-slate-200' : 'text-gray-700'}`}>Comunicação</h3>
        <button
          onClick={generateReport}
          disabled={reportLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-all disabled:opacity-50"
        >
          {reportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
          Expedir Relatório
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
        ) : messages.length === 0 ? (
          <p className={`text-sm text-center py-8 font-semibold ${dark ? 'text-slate-400' : 'text-gray-400'}`}>Nenhuma mensagem ainda. Envie a primeira!</p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl p-3 ${isMine ? 'bg-blue-600 text-white' : dark ? 'bg-slate-700 text-gray-100' : 'bg-gray-100 text-gray-800'}`}>
                  <p className="text-xs font-bold opacity-70 mb-1">{isMine ? 'Você' : msg.sender_name}</p>
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  {msg.attachments?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {msg.attachments.map((att, i) => (
                        <a
                          key={i}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2 text-xs p-2 rounded-lg transition-all ${
                            isMine ? 'bg-blue-500 text-white hover:bg-blue-400' : dark ? 'bg-slate-600 text-gray-200 hover:bg-slate-500 border border-slate-500' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                          }`}
                        >
                          {fileIcon(att.name)}
                          <span className="truncate flex-1">{att.name}</span>
                        </a>
                      ))}
                    </div>
                  )}
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-blue-200' : dark ? 'text-slate-400' : 'text-gray-400'}`}>{formatTime(msg.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {files.length > 0 && (
        <div className={`px-4 py-2 border-t flex flex-wrap gap-2 ${dark ? 'border-slate-600' : 'border-gray-100'}`}>
          {files.map((f, i) => (
            <span key={i} className={`inline-flex items-center gap-1 text-xs rounded-lg px-2 py-1 ${dark ? 'bg-slate-700 text-slate-200' : 'bg-gray-100 text-gray-800'}`}>
              {fileIcon(f.name)}
              <span className="truncate max-w-[120px]">{f.name}</span>
              <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className={`border-t p-4 flex items-end gap-2 ${dark ? 'border-slate-600' : 'border-gray-100'}`}>
        <label className={`p-2 rounded-lg cursor-pointer ${dark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'}`}>
          <Paperclip className="h-5 w-5" />
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
          />
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
          rows={2}
          className={`flex-1 rounded-xl p-3 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500 ${dark ? 'bg-slate-700 border border-slate-600 text-white placeholder-slate-400' : 'bg-gray-50 border border-gray-200'}`}
        />
        <button
          onClick={handleSend}
          disabled={sending || (!text.trim() && files.length === 0)}
          className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
};

export default CommunicationBlock;
