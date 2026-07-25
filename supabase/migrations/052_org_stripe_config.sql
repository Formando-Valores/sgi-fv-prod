-- Migration 052: Per-organization Stripe configuration
-- Allows admins to configure Stripe credentials per organization via UI

CREATE TABLE IF NOT EXISTS public.org_stripe_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Stripe credentials (encrypted at rest via application layer)
  stripe_secret_key_encrypted text,
  stripe_webhook_secret_encrypted text,

  -- Stripe settings
  stripe_api_version text NOT NULL DEFAULT '2025-03-31.basil',
  default_currency text NOT NULL DEFAULT 'brl',
  checkout_product_name text NOT NULL DEFAULT 'Serviço SGI FV',
  
  -- Environment toggle
  is_live_mode boolean NOT NULL DEFAULT false,

  -- Masked keys for UI display (last 4 chars)
  secret_key_last4 text,
  webhook_secret_last4 text,

  -- Metadata
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One config per org
  CONSTRAINT org_stripe_config_org_id_unique UNIQUE (org_id)
);

-- Enable RLS
ALTER TABLE public.org_stripe_config ENABLE ROW LEVEL SECURITY;

-- Admins/super_admins can manage Stripe config for their org
CREATE POLICY "org_stripe_config_admin_manage"
  ON public.org_stripe_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = public.org_stripe_config.org_id
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.user_id = auth.uid()
        AND om.org_id = public.org_stripe_config.org_id
        AND om.role IN ('owner', 'admin')
    )
  );

-- Super admins can manage all org configs
CREATE POLICY "org_stripe_config_superadmin_manage"
  ON public.org_stripe_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'administrator', 'administrador', 'super_admin', 'admin_master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'administrator', 'administrador', 'super_admin', 'admin_master')
    )
  );

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_org_stripe_config_org_id ON public.org_stripe_config(org_id);

-- Comment
COMMENT ON TABLE public.org_stripe_config IS 'Per-organization Stripe configuration. Keys are encrypted at rest by the application layer.';
