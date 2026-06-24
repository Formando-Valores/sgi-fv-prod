-- ============================================
-- SGI FV - Migration 036: Fix protocol generation concurrency
-- ============================================
-- A funcao generate_protocol() usava SELECT MAX(...)+1
-- que nao e concorrente-safe (duas insercoes simultaneas
-- podiam gerar o mesmo protocolo).
-- 
-- Corrigido com pg_advisory_xact_lock para serializar
-- a geracao de protocolo por ano.
-- ============================================

CREATE OR REPLACE FUNCTION generate_protocol()
RETURNS TRIGGER AS $$
DECLARE
  year_str text;
  seq_num int;
  lock_key int;
BEGIN
  IF NEW.protocolo IS NULL THEN
    year_str := to_char(now(), 'YYYY');
    lock_key := hashtext('sgi_protocol_' || year_str);
    PERFORM pg_advisory_xact_lock(lock_key);
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(protocolo FROM 'SGI-' || year_str || '-([0-9]+)') AS int)
    ), 0) + 1
    INTO seq_num
    FROM processes
    WHERE protocolo LIKE 'SGI-' || year_str || '-%';
    NEW.protocolo := 'SGI-' || year_str || '-' || LPAD(seq_num::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
