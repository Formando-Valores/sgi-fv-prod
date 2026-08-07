-- Migration 055: Per-org allowed currencies for Stripe checkout
-- Allows each org to define which currencies can be used in checkout.
-- Client picks the currency at payment time when more than one is allowed.

ALTER TABLE public.org_stripe_config
  ADD COLUMN IF NOT EXISTS allowed_currencies text[] NOT NULL DEFAULT ARRAY['eur'];

-- Backfill: existing orgs default to their configured default_currency
UPDATE public.org_stripe_config
SET allowed_currencies = ARRAY[default_currency]
WHERE allowed_currencies = ARRAY['eur'] AND default_currency != 'eur';
