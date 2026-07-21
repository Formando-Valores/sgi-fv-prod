ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS data_nascimento text,
  ADD COLUMN IF NOT EXISTS naturalidade text,
  ADD COLUMN IF NOT EXISTS niss text,
  ADD COLUMN IF NOT EXISTS validade_documento text,
  ADD COLUMN IF NOT EXISTS nacionalidade text,
  ADD COLUMN IF NOT EXISTS codigo_postal text,
  ADD COLUMN IF NOT EXISTS profissao text;