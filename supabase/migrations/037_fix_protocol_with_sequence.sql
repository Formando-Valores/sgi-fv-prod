-- ============================================
-- SGI FV - Migration 037: Protocol generation with sequence
-- ============================================
-- Substitui a logica MAX(...)+1 por uma sequence
-- garantindo unicidade mesmo com dados existentes.
-- A sequence e inicializada com o max protocolo + 1.
-- ============================================

CREATE SEQUENCE IF NOT EXISTS protocol_number_seq START 1;

-- Seta o valor inicial da sequence para o maximo protocolo existente + 1
DO $$
DECLARE
  max_seq int;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(protocolo FROM 'SGI-[0-9]+-([0-9]+)') AS int)
  ), 0) + 1 INTO max_seq FROM processes
  WHERE protocolo ~ '^SGI-[0-9]{4}-[0-9]+$';
  PERFORM setval('protocol_number_seq', max_seq, false);
END;
$$;

CREATE OR REPLACE FUNCTION generate_protocol()
RETURNS TRIGGER AS $$
DECLARE
  year_str text;
  seq_num bigint;
  max_existing int;
BEGIN
  IF NEW.protocolo IS NULL THEN
    year_str := to_char(now(), 'YYYY');
    seq_num := nextval('protocol_number_seq');
    NEW.protocolo := 'SGI-' || year_str || '-' || LPAD(seq_num::text, 4, '0');
    IF EXISTS (SELECT 1 FROM processes WHERE protocolo = NEW.protocolo) THEN
      SELECT COALESCE(MAX(
        CAST(SUBSTRING(protocolo FROM 'SGI-' || year_str || '-([0-9]+)') AS int)
      ), 0) + 1 INTO max_existing
      FROM processes
      WHERE protocolo ~ '^SGI-' || year_str || '-[0-9]+$';
      NEW.protocolo := 'SGI-' || year_str || '-' || LPAD(max_existing::text, 4, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
