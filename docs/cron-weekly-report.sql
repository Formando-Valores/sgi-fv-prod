-- ============================================================
-- Relatório semanal SIGA-FV (Edge Function weekly-org-report)
-- Segunda-feira às 07:00 UTC (= 07:00 Lisboa no inverno; 08:00 no verão).
--
-- ESTADO ATUAL:
--   - pg_cron e pg_net instalados pela migration 071.
--   - weekly_report_cron_secret gerado e guardado no Vault pela migration 072.
--   - RPC get_weekly_report_cron_secret acessível apenas à service_role.
--   - Job weekly-org-report criado pela migration 073.
--
-- Este ficheiro serve como referência para recriar manualmente o agendamento
-- caso seja necessário. Não é necessário executar se o job estiver ativo.
-- Não é necessário definir CRON_SECRET manualmente nas Edge Function Secrets.
-- RESEND_API_KEY e FROM_EMAIL continuam necessários para envio efetivo.
-- ============================================================

-- Verificar:
--   SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'weekly-org-report';
--   SELECT * FROM cron.job_run_details
--     WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'weekly-org-report')
--     ORDER BY start_time DESC LIMIT 5;
--   SELECT id, status_code, left(content::text, 300)
--     FROM net._http_response ORDER BY created DESC LIMIT 5;

-- Recriar o job manualmente (primeiro remove o job anterior, se existir):
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

-- Teste sem enviar e-mails (requer SUPABASE_SERVICE_ROLE_KEY no ambiente local):
--   curl -X POST https://ktrrrqaqaljdcmxqdcff.supabase.co/functions/v1/weekly-org-report \
--     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
--     -H "Content-Type: application/json" \
--     -d '{"dry_run": true}'

-- Preview para uma organização e destinatário de teste (dry_run obrigatório):
--   -d '{"org_id":"<ORG_UUID>","recipient":"teste@exemplo.pt","dry_run":true}'

-- Desativar / remover:
--   SELECT cron.unschedule('weekly-org-report');
