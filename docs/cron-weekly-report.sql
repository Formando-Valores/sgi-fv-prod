-- ============================================================
-- Agendamento do relatório semanal (Edge Function weekly-org-report)
-- Segunda-feira às 07:00 UTC (= 08:00 em Lisboa no horário de verão; 07:00 no inverno).
-- NÃO é uma migration: executar manualmente no SQL Editor depois de publicar a função
-- e de aplicar as migrations 066 e 067.
--
-- Pré-requisitos:
--   1) Extensões pg_cron e pg_net ativas (Database → Extensions).
--   2) Secret da Edge Function: CRON_SECRET (mínimo 16 caracteres) definido em
--      Edge Functions → Secrets. Guardar o MESMO valor no Vault (passo abaixo).
--   3) Secrets RESEND_API_KEY e FROM_EMAIL já existentes; APP_URL opcional.
-- Nenhum segredo fica escrito neste ficheiro: substituir o placeholder apenas no SQL Editor.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Guardar o segredo no Vault (executar uma vez; trocar <CRON_SECRET> pelo valor real no SQL Editor)
-- SELECT vault.create_secret('<CRON_SECRET>', 'weekly_report_cron_secret', 'Segredo do agendamento weekly-org-report');
-- Para atualizar mais tarde:
-- SELECT vault.update_secret(id, '<NOVO_CRON_SECRET>') FROM vault.secrets WHERE name = 'weekly_report_cron_secret';

-- Remover agendamento anterior com o mesmo nome (se existir)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'weekly-org-report';

SELECT cron.schedule(
  'weekly-org-report',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://ktrrrqaqaljdcmxqdcff.supabase.co/functions/v1/weekly-org-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'weekly_report_cron_secret' LIMIT 1)
    ),
    body := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 60000
  );
  $$
);

-- Verificar:
--   SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'weekly-org-report';
--   SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'weekly-org-report') ORDER BY start_time DESC LIMIT 5;
--   SELECT id, status_code, left(content::text, 300) FROM net._http_response ORDER BY created DESC LIMIT 5;

-- Teste manual (sem enviar e-mail), a partir de um terminal:
--   curl -X POST https://ktrrrqaqaljdcmxqdcff.supabase.co/functions/v1/weekly-org-report \
--     -H "Content-Type: application/json" -H "x-cron-secret: $CRON_SECRET" \
--     -d '{"dry_run": true}'
-- Teste de envio só para um destinatário de teste e uma organização:
--     -d '{"org_id": "d535afe4-6279-40a9-aaa9-f5a7f6ee4825", "recipient": "teste@exemplo.pt"}'

-- Desativar / remover:
--   SELECT cron.unschedule('weekly-org-report');
