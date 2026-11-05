import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellRing, CheckCircle2, AlertTriangle, UserPlus, CreditCard } from 'lucide-react';
import { supabase } from '../../../supabase';
import {
  canSeeActivityBell,
  countUnseen,
  describeActivityEvent,
  formatBadgeCount,
  type OrgActivityEvent,
} from '../../lib/notificationsAccess';

/**
 * Sino do painel (organização ativa):
 *  - Novidades: novos utilizadores e novos pagamentos (RPC get_org_activity, migration 066),
 *    com "Marcar como visto" (RPC mark_org_activity_seen).
 *  - Alertas: public.org_notifications (migration 064), ex. divergência de valor pago.
 * Visível só para owner, admin, sénior e pleno (staff) — ou para quem o servidor autorizar
 * (administrador global), via can_view_org_activity.
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

type NotificationsBellProps = {
  activeOrgId?: string | null;
  orgRole?: string | null;
};

const POLL_MS = 60_000;

const NotificationsBell: React.FC<NotificationsBellProps> = ({ activeOrgId, orgRole }) => {
  const roleAllowed = canSeeActivityBell(orgRole);
  const [serverAllowed, setServerAllowed] = useState<boolean | null>(roleAllowed ? true : null);
  const [events, setEvents] = useState<OrgActivityEvent[]>([]);
  const [activityAvailable, setActivityAvailable] = useState(true);
  const [alerts, setAlerts] = useState<OrgNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Papel não está na lista (ex.: administrador global noutra organização): pergunta ao servidor.
  useEffect(() => {
    let cancelled = false;
    if (roleAllowed) {
      setServerAllowed(true);
      return;
    }
    if (!activeOrgId) {
      setServerAllowed(false);
      return;
    }
    void supabase.rpc('can_view_org_activity', { p_org_id: activeOrgId }).then(({ data, error }) => {
      if (!cancelled) setServerAllowed(!error && data === true);
    });
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, roleAllowed]);

  const visible = Boolean(activeOrgId) && serverAllowed === true;

  const load = useCallback(async () => {
    if (!activeOrgId || !visible) return;
    const [activityRes, alertsRes] = await Promise.all([
      supabase.rpc('get_org_activity', { p_org_id: activeOrgId, p_limit: 30 }),
      supabase
        .from('org_notifications')
        .select('id, org_id, type, severity, title, body, process_id, read_at, created_at')
        .eq('org_id', activeOrgId)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    if (activityRes.error) {
      setActivityAvailable(false);
      setEvents([]);
    } else {
      setActivityAvailable(true);
      setEvents((activityRes.data ?? []) as OrgActivityEvent[]);
    }
    setAlerts(alertsRes.error ? [] : ((alertsRes.data ?? []) as OrgNotification[]));
  }, [activeOrgId, visible]);

  useEffect(() => {
    if (!visible) return;
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load, visible]);

  useEffect(() => {
    if (!open) return;
    const onClick = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!visible) return null;

  const unseen = countUnseen(events) + alerts.length;
  const badge = formatBadgeCount(unseen);

  const markAllSeen = async () => {
    if (!activeOrgId) return;
    setMarking(true);
    const { error } = await supabase.rpc('mark_org_activity_seen', { p_org_id: activeOrgId });
    if (!error) setEvents((prev) => prev.map((e) => ({ ...e, is_unseen: false })));
    if (alerts.length) {
      const { data: s } = await supabase.auth.getSession();
      const now = new Date().toISOString();
      await supabase
        .from('org_notifications')
        .update({ read_at: now, read_by: s?.session?.user?.id ?? null })
        .in('id', alerts.map((a) => a.id));
      setAlerts([]);
    }
    setMarking(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`p-2 rounded-xl transition-colors relative ${
          unseen > 0
            ? 'bg-surface-800 text-white hover:bg-surface-700'
            : 'text-surface-400 hover:bg-surface-100 hover:text-surface-600'
        }`}
        aria-label={unseen > 0 ? `${unseen} novidades por ver` : 'Novidades'}
        title={unseen > 0 ? `${unseen} novidades por ver` : 'Sem novidades por ver'}
      >
        {unseen > 0 ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        {badge && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white flex items-center justify-center">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] sm:w-96 max-h-[70vh] overflow-y-auto z-50 rounded-xl border border-surface-200 bg-white shadow-xl">
          <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between gap-2">
            <span className="font-bold text-surface-800 text-sm">Novidades da organização</span>
            <button
              type="button"
              onClick={() => void markAllSeen()}
              disabled={marking || unseen === 0}
              className="text-[11px] font-semibold text-primary-600 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              {marking ? 'A marcar…' : 'Marcar como visto'}
            </button>
          </div>

          {alerts.map((n) => (
            <div key={n.id} className="px-4 py-3 border-b border-surface-100 text-sm bg-amber-50/60">
              <div className="flex items-start gap-2">
                {n.severity === 'critical'
                  ? <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  : <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-surface-800">{n.title}</p>
                  {n.body && <p className="text-surface-600 mt-0.5">{n.body}</p>}
                  <p className="text-[11px] text-surface-400 mt-1">{new Date(n.created_at).toLocaleString('pt-PT')}</p>
                </div>
              </div>
            </div>
          ))}

          {!activityAvailable && (
            <p className="px-4 py-6 text-sm text-surface-500">As novidades ficam disponíveis após aplicar a migration 066.</p>
          )}
          {activityAvailable && events.length === 0 && alerts.length === 0 && (
            <p className="px-4 py-6 text-sm text-surface-500">Sem novidades nos últimos 30 dias.</p>
          )}

          {events.map((e) => {
            const { title, description } = describeActivityEvent(e);
            const Icon = e.event_type === 'payment_paid' ? CreditCard : UserPlus;
            return (
              <div key={e.event_id} className={`px-4 py-3 border-b border-surface-100 text-sm ${e.is_unseen ? 'bg-primary-50/40' : 'opacity-70'}`}>
                <div className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${e.event_type === 'payment_paid' ? 'text-emerald-600' : 'text-primary-600'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-surface-800 flex items-center gap-2">
                      {title}
                      {e.is_unseen && <span className="inline-block w-2 h-2 rounded-full bg-red-500" aria-label="Não visto" />}
                    </p>
                    {description && <p className="text-surface-600 mt-0.5 break-words">{description}</p>}
                    <p className="text-[11px] text-surface-400 mt-1">{new Date(e.occurred_at).toLocaleString('pt-PT')}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsBell;
