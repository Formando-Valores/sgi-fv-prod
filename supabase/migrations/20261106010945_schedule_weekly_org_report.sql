-- Agendamento semanal do relatório SIGA-FV.
-- O segredo é lido do Vault em runtime; não fica hardcoded no comando pg_cron.
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'weekly-org-report'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'weekly-org-report',
    '0 7 * * 1',
    $job$
      SELECT net.http_post(
        url := 'https://ktrrrqaqaljdcmxqdcff.supabase.co/functions/v1/weekly-org-report',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'weekly_report_cron_secret'
            LIMIT 1
          )
        ),
        body := jsonb_build_object('source', 'pg_cron'),
        timeout_milliseconds := 60000
      );
    $job$
  );
END
$$;
