-- ============================================
-- SGI FV - Migration 035: Add services_selected
-- Stores which catalog services were selected
-- when creating a process
-- ============================================

ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS services_selected jsonb;
