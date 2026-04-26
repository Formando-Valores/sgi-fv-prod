-- ============================================
-- SGI FV - Migration 023: trilha mínima de consentimento por perfil
-- ============================================
-- Data: 2026-04-26
-- Descrição:
--   - Cria tabela dedicada public.profile_consents
--   - Registra versões de texto e flags de consentimento no momento do cadastro
--   - Aplica RLS com leitura escopada por organização e escrita do próprio usuário
-- ============================================

CREATE TABLE IF NOT EXISTS public.profile_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL,
  consent_text_version text NOT NULL,
  privacy_policy_accepted boolean NOT NULL,
  service_contact_accepted boolean NOT NULL DEFAULT false,
  informative_comms_accepted boolean NOT NULL DEFAULT false,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent text
);

COMMENT ON TABLE public.profile_consents IS 'Registro histórico de consentimentos por perfil com versão do texto aceito.';
COMMENT ON COLUMN public.profile_consents.source IS 'Origem da captura do consentimento (ex.: register-web, wix-intake).';
COMMENT ON COLUMN public.profile_consents.consent_text_version IS 'Versão canônica do texto de consentimento exibido ao usuário.';

CREATE INDEX IF NOT EXISTS idx_profile_consents_profile_id_accepted_at
  ON public.profile_consents(profile_id, accepted_at DESC);

ALTER TABLE public.profile_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own profile consents" ON public.profile_consents;
CREATE POLICY "Users can insert own profile consents"
  ON public.profile_consents FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
  );

DROP POLICY IF EXISTS "Scoped users can view profile consents" ON public.profile_consents;
CREATE POLICY "Scoped users can view profile consents"
  ON public.profile_consents FOR SELECT
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.org_members om ON om.org_id = p.org_id
      WHERE p.id = profile_consents.profile_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'staff')
    )
    OR public.is_default_org_admin(auth.uid())
  );
