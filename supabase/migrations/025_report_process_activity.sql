-- ============================================
-- SGI FV - Migration 025: Report process activity RPCs
-- ============================================
-- Data: 2026-04-26
-- Descrição:
--   - Cria RPC paginada para relatório de atividades de processos
--   - Cria RPC de estatísticas agregadas para cards do relatório
-- ============================================

CREATE OR REPLACE FUNCTION public.report_process_activity(
  p_org_id uuid DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL,
  p_process_status text DEFAULT NULL,
  p_event_type text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_sort_order text DEFAULT 'desc'
)
RETURNS TABLE (
  process_id uuid,
  org_id uuid,
  protocol text,
  title text,
  client_name text,
  process_status text,
  process_type text,
  responsible_user_id uuid,
  responsible_name text,
  actor_user_id uuid,
  actor_name text,
  organization_name text,
  latest_event_id uuid,
  latest_event_type text,
  latest_event_message text,
  latest_event_at timestamptz,
  event_count bigint,
  process_created_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
WITH filtered AS (
  SELECT
    p.id AS process_id,
    p.org_id,
    p.protocolo,
    p.titulo,
    p.cliente_nome,
    COALESCE(p.process_status::text, p.status::text) AS process_status,
    p.unidade_atendimento AS process_type,
    p.responsavel_user_id,
    COALESCE(responsible.nome_completo, responsible.email, p.responsavel_user_id::text, 'Não atribuído') AS responsible_name,
    org.name AS organization_name,
    p.created_at AS process_created_at,
    pe.id AS event_id,
    COALESCE(pe.event_type, pe.tipo) AS event_type,
    pe.mensagem AS event_message,
    COALESCE(pe.actor_user_id, pe.created_by) AS event_actor_user_id,
    COALESCE(actor.nome_completo, actor.email, COALESCE(pe.actor_user_id, pe.created_by)::text, 'Sistema') AS event_actor_name,
    pe.created_at AS event_created_at
  FROM public.processes p
  LEFT JOIN public.process_events pe
    ON pe.process_id = p.id
   AND pe.org_id = p.org_id
  LEFT JOIN public.profiles responsible
    ON responsible.id = p.responsavel_user_id
  LEFT JOIN public.profiles actor
    ON actor.id = COALESCE(pe.actor_user_id, pe.created_by)
  LEFT JOIN public.organizations org
    ON org.id = p.org_id
  WHERE
    (p_org_id IS NULL OR p.org_id = p_org_id)
    AND (p_process_status IS NULL OR p_process_status = '' OR p_process_status = 'all' OR lower(COALESCE(p.process_status::text, p.status::text, '')) = lower(p_process_status))
    AND (p_actor_user_id IS NULL OR COALESCE(pe.actor_user_id, pe.created_by) = p_actor_user_id)
    AND (p_event_type IS NULL OR p_event_type = '' OR p_event_type = 'all' OR lower(COALESCE(pe.event_type, pe.tipo, '')) = lower(p_event_type))
    AND (p_date_from IS NULL OR COALESCE(pe.created_at, p.created_at) >= p_date_from)
    AND (p_date_to IS NULL OR COALESCE(pe.created_at, p.created_at) <= p_date_to)
    AND (
      p_search IS NULL
      OR trim(p_search) = ''
      OR p.protocolo ILIKE '%' || trim(p_search) || '%'
      OR p.titulo ILIKE '%' || trim(p_search) || '%'
      OR p.cliente_nome ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(pe.mensagem, '') ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(actor.nome_completo, actor.email, '') ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(responsible.nome_completo, responsible.email, '') ILIKE '%' || trim(p_search) || '%'
    )
), ranked AS (
  SELECT
    filtered.*,
    row_number() OVER (PARTITION BY filtered.process_id ORDER BY filtered.event_created_at DESC NULLS LAST, filtered.process_created_at DESC) AS rn,
    count(filtered.event_id) OVER (PARTITION BY filtered.process_id) AS event_count
  FROM filtered
)
SELECT
  ranked.process_id,
  ranked.org_id,
  ranked.protocolo AS protocol,
  ranked.titulo AS title,
  ranked.cliente_nome AS client_name,
  ranked.process_status,
  ranked.process_type,
  ranked.responsavel_user_id AS responsible_user_id,
  ranked.responsible_name,
  ranked.event_actor_user_id AS actor_user_id,
  ranked.event_actor_name AS actor_name,
  ranked.organization_name,
  ranked.event_id AS latest_event_id,
  ranked.event_type AS latest_event_type,
  ranked.event_message AS latest_event_message,
  ranked.event_created_at AS latest_event_at,
  ranked.event_count,
  ranked.process_created_at
FROM ranked
WHERE ranked.rn = 1
ORDER BY
  CASE WHEN lower(COALESCE(p_sort_order, 'desc')) = 'asc' THEN COALESCE(ranked.event_created_at, ranked.process_created_at) END ASC,
  CASE WHEN lower(COALESCE(p_sort_order, 'desc')) <> 'asc' THEN COALESCE(ranked.event_created_at, ranked.process_created_at) END DESC
LIMIT GREATEST(COALESCE(p_limit, 20), 1)
OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.report_process_activity_stats(
  p_org_id uuid DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL,
  p_process_status text DEFAULT NULL,
  p_event_type text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
WITH filtered AS (
  SELECT
    p.id AS process_id,
    p.org_id,
    COALESCE(p.process_status::text, p.status::text, 'sem_status') AS process_status,
    COALESCE(pe.event_type, pe.tipo, 'sem_evento') AS event_type,
    COALESCE(pe.actor_user_id, pe.created_by) AS actor_user_id,
    COALESCE(actor.nome_completo, actor.email, COALESCE(pe.actor_user_id, pe.created_by)::text, 'Sistema') AS actor_name,
    COALESCE(org.name, p.org_id::text) AS organization_name
  FROM public.processes p
  LEFT JOIN public.process_events pe
    ON pe.process_id = p.id
   AND pe.org_id = p.org_id
  LEFT JOIN public.profiles actor
    ON actor.id = COALESCE(pe.actor_user_id, pe.created_by)
  LEFT JOIN public.profiles responsible
    ON responsible.id = p.responsavel_user_id
  LEFT JOIN public.organizations org
    ON org.id = p.org_id
  WHERE
    (p_org_id IS NULL OR p.org_id = p_org_id)
    AND (p_process_status IS NULL OR p_process_status = '' OR p_process_status = 'all' OR lower(COALESCE(p.process_status::text, p.status::text, '')) = lower(p_process_status))
    AND (p_actor_user_id IS NULL OR COALESCE(pe.actor_user_id, pe.created_by) = p_actor_user_id)
    AND (p_event_type IS NULL OR p_event_type = '' OR p_event_type = 'all' OR lower(COALESCE(pe.event_type, pe.tipo, '')) = lower(p_event_type))
    AND (p_date_from IS NULL OR COALESCE(pe.created_at, p.created_at) >= p_date_from)
    AND (p_date_to IS NULL OR COALESCE(pe.created_at, p.created_at) <= p_date_to)
    AND (
      p_search IS NULL
      OR trim(p_search) = ''
      OR p.protocolo ILIKE '%' || trim(p_search) || '%'
      OR p.titulo ILIKE '%' || trim(p_search) || '%'
      OR p.cliente_nome ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(pe.mensagem, '') ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(actor.nome_completo, actor.email, '') ILIKE '%' || trim(p_search) || '%'
      OR COALESCE(responsible.nome_completo, responsible.email, '') ILIKE '%' || trim(p_search) || '%'
    )
), distinct_processes AS (
  SELECT DISTINCT process_id, process_status, organization_name
  FROM filtered
)
SELECT jsonb_build_object(
  'total', (SELECT count(*) FROM distinct_processes),
  'byStatus', COALESCE((SELECT jsonb_agg(jsonb_build_object('key', process_status, 'total', total)) FROM (SELECT process_status, count(*) AS total FROM distinct_processes GROUP BY process_status ORDER BY total DESC) s), '[]'::jsonb),
  'byEventType', COALESCE((SELECT jsonb_agg(jsonb_build_object('key', event_type, 'total', total)) FROM (SELECT event_type, count(*) AS total FROM filtered GROUP BY event_type ORDER BY total DESC) e), '[]'::jsonb),
  'byActor', COALESCE((SELECT jsonb_agg(jsonb_build_object('key', actor_name, 'total', total)) FROM (SELECT actor_name, count(*) AS total FROM filtered GROUP BY actor_name ORDER BY total DESC) a), '[]'::jsonb),
  'byOrganization', COALESCE((SELECT jsonb_agg(jsonb_build_object('key', organization_name, 'total', total)) FROM (SELECT organization_name, count(*) AS total FROM distinct_processes GROUP BY organization_name ORDER BY total DESC) o), '[]'::jsonb),
  'byUser', COALESCE((SELECT jsonb_agg(jsonb_build_object('key', actor_name, 'total', total)) FROM (SELECT actor_name, count(*) AS total FROM filtered GROUP BY actor_name ORDER BY total DESC) u), '[]'::jsonb)
);
$$;

GRANT EXECUTE ON FUNCTION public.report_process_activity(uuid, uuid, text, text, timestamptz, timestamptz, text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_process_activity_stats(uuid, uuid, text, text, timestamptz, timestamptz, text) TO authenticated;
