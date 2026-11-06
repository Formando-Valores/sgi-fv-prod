-- Infraestrutura necessária ao agendamento seguro do relatório semanal.
-- O job só será criado depois de configurar o segredo CRON_SECRET no Edge Function
-- e a mesma chave no Vault (weekly_report_cron_secret).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
