-- Add association_fees column to processes
ALTER TABLE processes
ADD COLUMN IF NOT EXISTS association_fees JSONB DEFAULT NULL;

COMMENT ON COLUMN processes.association_fees IS 'Taxas associativas calculadas no momento da criacao do processo. Array de {type, name, price, destination}. Ex: [{type: "annual", name: "Taxa Associativa Anual", price: 150, destination: "association"}, {type: "convenio", name: "Convenio 02", price: 300, destination: "association"}]';
