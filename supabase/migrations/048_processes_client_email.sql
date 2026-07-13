ALTER TABLE processes ADD COLUMN cliente_email text;

COMMENT ON COLUMN processes.cliente_email IS 'Email do cliente para envio de credenciais de acesso';
