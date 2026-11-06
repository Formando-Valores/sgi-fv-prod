-- MISSÃO 003: segredo do agendamento semanal gerado automaticamente e guardado no Vault.
-- Só service_role pode obter o valor por RPC; o segredo nunca é exposto ao frontend.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'weekly_report_cron_secret'
  ) THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'weekly_report_cron_secret',
      'Segredo de autenticação do pg_cron para weekly-org-report'
    );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_weekly_report_cron_secret()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso reservado à service role' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT ds.decrypted_secret
    FROM vault.decrypted_secrets ds
    WHERE ds.name = 'weekly_report_cron_secret'
    LIMIT 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_weekly_report_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_report_cron_secret() TO service_role;
