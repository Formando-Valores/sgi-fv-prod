-- Corrige origem_canal dos processos enviados pelo formulário vainaai.pt
-- que foram criados sem o parâmetro source (antes da atualização)

UPDATE processes
SET origem_canal = 'vainaai'
WHERE protocolo IN ('SGI-2026-0039', 'SGI-2026-0040')
  AND origem_canal = 'painel';
