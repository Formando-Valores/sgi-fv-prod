import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../supabase';

/**
 * MISSÃO 002: alertas da organização (ex.: "Pagamento recebido").
 * Lê public.org_notifications (migration 064). A RLS só devolve linhas a
 * administradores da organização / administrador global; para os restantes
 * a lista fica simplesmente vazia. Se a tabela ainda não existir, o sino fica neutro.
 */
type OrgNotification = {
  id: string;
  org_id: string;
  type: string;
  severity: string;
  title: string;
  body: string | null;
  process_id: string | null;
  read_at: string | null;
  created_at: string;
};

const POLL_MS = 60_000;

const NotificationsBell: React.FC = () => {
  const [items, setItems] = useState<OrgNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState(true);
  const lastSeenRef = useRef<string | null>(null);
  const [flash, setFlash] = useState<OrgNotification | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('org_notifications')
      .select('id, org_id, type, severity, title, body, process_id, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      setAvailable(false);
      return;
    }
    const rows = (data ?? []) as OrgNotification[];
    setAvailable(true);
    setItems(rows);
    const newestUnread = rows.find((n) => !n.read_at);
    if (newestUnread && lastSeenRef.current && newestUnread.created_at > lastSeenRef.current) {
      setFlash(newestUnread);
      window.setTimeout(() => setFlash(null), 8000);
    }
    if (rows[0]) lastSeenRef.current = rows[0].created_at;
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const markRead = async (n: OrgNotification) => {
    const { data: s } = await supabase.auth.getSession();
    await supabase
      .from('org_notifications')
      .update({ read_at: new Date().toISOString(), read_by: s?.session?.user?.id ?? null })
      .eq('id', n.id);
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
  };

  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-xl text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors relative"
        aria-label={unread > 0 ? `${unread} alertas por ler` : 'Alertas'}
        title={available ? 'Alertas da organização' : 'Alertas indisponíveis (migration 064 não aplicada)'}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {flash && !open && (
        <div className="absolute right-0 mt-2 w-80 z-50 rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-lg text-sm text-emerald-900">
          <p className="font-bold">{flash.title}</p>
          {flash.body && <p className="mt-1 text-emerald-800">{flash.body}</p>}
        </div>
      )}

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[70vh] overflow-y-auto z-50 rounded-xl border border-surface-200 bg-white shadow-xl">
          <div className="px-4 py-3 border-b border-surface-100 font-bold text-surface-800 text-sm">Alertas da organização</div>
          {!available && (
            <p className="px-4 py-6 text-sm text-surface-500">Os alertas ficam disponíveis após aplicar a migration 064 (org_notifications).</p>
          )}
          {available && items.length === 0 && (
            <p className="px-4 py-6 text-sm text-surface-500">Sem alertas.</p>
          )}
          {items.map((n) => (
            <div key={n.id} className={`px-4 py-3 border-b border-surface-100 text-sm ${n.read_at ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-2">
                {n.severity === 'critical'
                  ? <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  : <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-surface-800">{n.title}</p>
                  {n.body && <p className="text-surface-600 mt-0.5">{n.body}</p>}
                  <p className="text-[11px] text-surface-400 mt-1">{new Date(n.created_at).toLocaleString('pt-PT')}</p>
                </div>
                {!n.read_at && (
                  <button type="button" onClick={() => void markRead(n)} className="text-[11px] font-semibold text-primary-600 hover:underline shrink-0">
                    Marcar lida
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsBell;
