import { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { sanitizeDisplayValue } from '../../src/lib/clientUtils';

const CHECKLIST_EVENT_PREFIX = 'CHECKLIST_EVENT:';

export type ProcessChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  createdByName?: string;
  updatedAt?: string;
  updatedByName?: string;
};

const getEditingProcessRecordId = (user: { processRecordId?: string; id?: string } | null) =>
  sanitizeDisplayValue(user?.processRecordId || user?.id);

const buildChecklistFromEvents = (
  events: Array<{ mensagem?: string | null; created_at?: string | null; created_by?: string | null }>,
  userNameById: Record<string, string>
): ProcessChecklistItem[] => {
  const checklistMap = new Map<string, ProcessChecklistItem>();

  events.forEach((event) => {
    const rawMessage = sanitizeDisplayValue(event.mensagem);
    if (!rawMessage) return;
    if (!rawMessage.startsWith(CHECKLIST_EVENT_PREFIX)) return;

    try {
      const payload = JSON.parse(rawMessage.slice(CHECKLIST_EVENT_PREFIX.length)) as {
        action?: 'add' | 'toggle' | 'edit' | 'delete';
        itemId?: string;
        text?: string;
        completed?: boolean;
        actorName?: string;
      };

      if (!payload?.action || !payload.itemId) return;

      if (payload.action === 'add' && payload.text) {
        checklistMap.set(payload.itemId, {
          id: payload.itemId,
          text: payload.text,
          completed: false,
          createdAt: event.created_at || new Date().toISOString(),
          createdByName: payload.actorName || (event.created_by ? userNameById[event.created_by] : '') || 'Administrador',
        });
        return;
      }

      if (payload.action === 'toggle' && checklistMap.has(payload.itemId)) {
        const existing = checklistMap.get(payload.itemId)!;
        checklistMap.set(payload.itemId, {
          ...existing,
          completed: Boolean(payload.completed),
          updatedAt: event.created_at || existing.updatedAt,
          updatedByName: payload.actorName || (event.created_by ? userNameById[event.created_by] : '') || existing.updatedByName || 'Administrador',
        });
        return;
      }

      if (payload.action === 'edit' && checklistMap.has(payload.itemId) && payload.text) {
        const existing = checklistMap.get(payload.itemId)!;
        checklistMap.set(payload.itemId, {
          ...existing,
          text: payload.text,
          updatedAt: event.created_at || existing.updatedAt,
          updatedByName: payload.actorName || (event.created_by ? userNameById[event.created_by] : '') || existing.updatedByName || 'Administrador',
        });
        return;
      }

      if (payload.action === 'delete' && checklistMap.has(payload.itemId)) {
        checklistMap.delete(payload.itemId);
      }
    } catch {
      // ignora mensagens antigas de outros formatos
    }
  });

  return Array.from(checklistMap.values()).sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return aTime - bTime;
  });
};

export function useChecklist(
  editingUser: { processRecordId?: string; id?: string; organizationId?: string } | null,
  currentUser: { id: string; name?: string },
  activeOrgId: string | null
) {
  const [processChecklist, setProcessChecklist] = useState<ProcessChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<string | null>(null);
  const [editingChecklistText, setEditingChecklistText] = useState('');
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistError, setChecklistError] = useState('');

  useEffect(() => {
    const processId = getEditingProcessRecordId(editingUser);
    if (!processId) {
      setProcessChecklist([]);
      setChecklistError('');
      setNewChecklistText('');
      return;
    }

    const loadChecklist = async () => {
      setChecklistLoading(true);
      setChecklistError('');

      const { data, error } = await supabase
        .from('process_events')
        .select('mensagem,created_at,created_by')
        .eq('process_id', processId)
        .eq('tipo', 'observacao')
        .order('created_at', { ascending: true });

      if (error) {
        setChecklistError('Não foi possível carregar o checklist deste processo.');
        setChecklistLoading(false);
        return;
      }

      const events = (data || []) as Array<{ mensagem?: string | null; created_at?: string | null; created_by?: string | null }>;
      const userIds = Array.from(new Set(events.map((event) => event.created_by).filter(Boolean))) as string[];
      let userNameById: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id,nome_completo,nome,name,email')
          .in('id', userIds);

        userNameById = ((profileRows || []) as Array<{ id: string; nome_completo?: string | null; nome?: string | null; name?: string | null; email?: string | null }>)
          .reduce<Record<string, string>>((accumulator, profile) => {
            accumulator[profile.id] =
              sanitizeDisplayValue(profile.nome_completo) ||
              sanitizeDisplayValue(profile.nome) ||
              sanitizeDisplayValue(profile.name) ||
              sanitizeDisplayValue(profile.email) ||
              'Administrador';
            return accumulator;
          }, {});
      }

      const checklist = buildChecklistFromEvents(events, userNameById);
      setProcessChecklist(checklist);
      setChecklistLoading(false);
      setEditingChecklistItemId(null);
      setEditingChecklistText('');
    };

    void loadChecklist();
  }, [editingUser]);

  const handleAddChecklistItem = async () => {
    const processId = getEditingProcessRecordId(editingUser);
    const normalizedText = sanitizeDisplayValue(newChecklistText);

    if (!processId || !normalizedText) return;

    const itemId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const newItem: ProcessChecklistItem = {
      id: itemId,
      text: normalizedText,
      completed: false,
      createdAt: nowIso,
      createdByName: currentUser.name || 'Administrador',
    };

    setProcessChecklist((prev) => [...prev, newItem]);
    setNewChecklistText('');
    setChecklistError('');

    const { error } = await supabase.from('process_events').insert({
      org_id: (editingUser as any)?.organizationId || activeOrgId,
      process_id: processId,
      tipo: 'observacao',
      mensagem: `${CHECKLIST_EVENT_PREFIX}${JSON.stringify({ action: 'add', itemId, text: normalizedText, actorName: currentUser.name || 'Administrador' })}`,
      created_by: currentUser.id,
    });

    if (error) {
      setChecklistError('Não foi possível salvar o novo item do checklist.');
      setProcessChecklist((prev) => prev.filter((item) => item.id !== itemId));
    }
  };

  const handleToggleChecklistItem = async (itemId: string, completed: boolean) => {
    const processId = getEditingProcessRecordId(editingUser);
    if (!processId) return;

    setChecklistError('');
    setProcessChecklist((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, completed, updatedAt: new Date().toISOString() } : item
      )
    );

    const { error } = await supabase.from('process_events').insert({
      org_id: (editingUser as any)?.organizationId || activeOrgId,
      process_id: processId,
      tipo: 'observacao',
      mensagem: `${CHECKLIST_EVENT_PREFIX}${JSON.stringify({ action: 'toggle', itemId, completed, actorName: currentUser.name || 'Administrador' })}`,
      created_by: currentUser.id,
    });

    if (error) {
      setChecklistError('Não foi possível atualizar o checklist.');
      setProcessChecklist((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, completed: !completed } : item))
      );
    }
  };

  const handleEditChecklistItem = async (itemId: string, text: string) => {
    const processId = getEditingProcessRecordId(editingUser);
    const normalizedText = sanitizeDisplayValue(text);
    if (!processId || !normalizedText) return;

    setChecklistError('');
    const currentItem = processChecklist.find((item) => item.id === itemId);
    if (!currentItem) return;

    setProcessChecklist((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, text: normalizedText, updatedAt: new Date().toISOString(), updatedByName: currentUser.name || 'Administrador' }
          : item
      )
    );

    const { error } = await supabase.from('process_events').insert({
      org_id: (editingUser as any)?.organizationId || activeOrgId,
      process_id: processId,
      tipo: 'observacao',
      mensagem: `${CHECKLIST_EVENT_PREFIX}${JSON.stringify({ action: 'edit', itemId, text: normalizedText, actorName: currentUser.name || 'Administrador' })}`,
      created_by: currentUser.id,
    });

    if (error) {
      setChecklistError('Não foi possível editar o item do checklist.');
      setProcessChecklist((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, text: currentItem.text, updatedAt: currentItem.updatedAt, updatedByName: currentItem.updatedByName }
            : item
        )
      );
      return;
    }

    setEditingChecklistItemId(null);
    setEditingChecklistText('');
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    const processId = getEditingProcessRecordId(editingUser);
    if (!processId) return;

    setChecklistError('');
    const previousItems = processChecklist;
    setProcessChecklist((prev) => prev.filter((item) => item.id !== itemId));
    if (editingChecklistItemId === itemId) {
      setEditingChecklistItemId(null);
      setEditingChecklistText('');
    }

    const { error } = await supabase.from('process_events').insert({
      org_id: (editingUser as any)?.organizationId || activeOrgId,
      process_id: processId,
      tipo: 'observacao',
      mensagem: `${CHECKLIST_EVENT_PREFIX}${JSON.stringify({ action: 'delete', itemId, actorName: currentUser.name || 'Administrador' })}`,
      created_by: currentUser.id,
    });

    if (error) {
      setChecklistError('Não foi possível excluir o item do checklist.');
      setProcessChecklist(previousItems);
    }
  };

  return {
    processChecklist,
    newChecklistText,
    setNewChecklistText,
    editingChecklistItemId,
    setEditingChecklistItemId,
    editingChecklistText,
    setEditingChecklistText,
    checklistLoading,
    checklistError,
    handleAddChecklistItem,
    handleToggleChecklistItem,
    handleEditChecklistItem,
    handleDeleteChecklistItem,
  };
}
