-- Modelo financeiro de contribuições associativas e complementares por OS

DO $$ BEGIN
  CREATE TYPE public.charge_type_enum AS ENUM ('service','annual_membership','complementary_agreement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.org_financial_settings (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  annual_membership_amount numeric(12,2) NOT NULL DEFAULT 0,
  annual_due_day smallint NOT NULL DEFAULT 31,
  annual_due_month smallint NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_complementary_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  range_min numeric(12,2) NOT NULL,
  range_max numeric(12,2),
  contribution_amount numeric(12,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (range_max IS NULL OR range_max >= range_min)
);
CREATE INDEX IF NOT EXISTS idx_org_complementary_tiers_org ON public.org_complementary_tiers(org_id, active, range_min);

ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS os_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS complementary_contribution_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS annual_membership_locked boolean NOT NULL DEFAULT false;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS charge_type public.charge_type_enum NOT NULL DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS reference_year integer,
  ADD COLUMN IF NOT EXISTS notes text;
CREATE INDEX IF NOT EXISTS idx_payments_charge_type ON public.payments(charge_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.financial_audit_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE,
  event_code text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notified_emails text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.calculate_complementary_contribution(p_org_id uuid, p_os_value numeric)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((
    SELECT t.contribution_amount
    FROM public.org_complementary_tiers t
    WHERE t.org_id = p_org_id
      AND t.active = true
      AND p_os_value >= t.range_min
      AND (t.range_max IS NULL OR p_os_value <= t.range_max)
    ORDER BY t.range_min DESC
    LIMIT 1
  ), 0::numeric);
$$;

CREATE OR REPLACE FUNCTION public.has_pending_annual_membership(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.charge_type = 'annual_membership'
      AND p.process_id IS NULL
      AND p.client_id IS NULL
      AND COALESCE(to_jsonb(p)->>'payment_status', to_jsonb(p)->>'status', 'pending') IN ('pending','failed','canceled')
      AND p.reference_year = EXTRACT(YEAR FROM now())::integer
      AND p.org_id = p_org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.processes_enforce_financial_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.os_value IS NOT NULL AND NEW.os_value > 0 THEN
    NEW.complementary_contribution_amount := public.calculate_complementary_contribution(NEW.org_id, NEW.os_value);
  END IF;

  IF public.has_pending_annual_membership(NEW.org_id) THEN
    RAISE EXCEPTION 'Contribuição associativa anual pendente. Liberação de novas OS bloqueada.' USING ERRCODE = 'P0001';
  END IF;

  NEW.annual_membership_locked := false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_processes_enforce_financial_rules ON public.processes;
CREATE TRIGGER trg_processes_enforce_financial_rules
BEFORE INSERT OR UPDATE OF os_value ON public.processes
FOR EACH ROW
EXECUTE FUNCTION public.processes_enforce_financial_rules();

CREATE OR REPLACE FUNCTION public.audit_payment_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.financial_audit_notifications (org_id, payment_id, event_code, payload)
  VALUES (
    COALESCE(NEW.org_id, OLD.org_id, (SELECT org_id FROM public.processes WHERE id = COALESCE(NEW.process_id, OLD.process_id))),
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW), 'at', now())
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_audit_notify ON public.payments;
CREATE TRIGGER trg_payments_audit_notify
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.audit_payment_change();

UPDATE public.payments p
SET org_id = pr.org_id
FROM public.processes pr
WHERE p.org_id IS NULL AND p.process_id = pr.id;

CREATE INDEX IF NOT EXISTS idx_payments_org_id ON public.payments(org_id, created_at DESC);
