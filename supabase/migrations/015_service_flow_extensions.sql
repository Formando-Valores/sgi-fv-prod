-- Extensão não destrutiva para fluxos NORMAL e ASSOCIAÇÃO/CONVÊNIO
-- Objetivo: adicionar estrutura complementar sem quebrar funcionalidades atuais.

-- 1) Catálogo de serviços com preço normal, preço convênio e contribuição complementar
CREATE TABLE IF NOT EXISTS service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  valor_normal numeric(12,2) NOT NULL DEFAULT 0,
  valor_convenio numeric(12,2),
  contribuicao_complementar numeric(12,2) NOT NULL DEFAULT 0,
  exige_associacao boolean NOT NULL DEFAULT false,
  prazo_dias_previsto integer,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_catalog_org_id ON service_catalog(org_id);

-- 2) Checklist por serviço
CREATE TABLE IF NOT EXISTS service_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  obrigatorio boolean NOT NULL DEFAULT true,
  exige_documento boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_checklist_items_service_id ON service_checklist_items(service_id);

-- 3) Associação ativa (convênio)
CREATE TABLE IF NOT EXISTS client_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contribution_value numeric(12,2) NOT NULL DEFAULT 25,
  contribution_currency text NOT NULL DEFAULT 'EUR',
  payment_transaction_id text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ativo', 'expirado', 'cancelado')),
  valid_from date,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, client_user_id)
);

CREATE INDEX IF NOT EXISTS idx_client_associations_org_client ON client_associations(org_id, client_user_id);

-- 4) Pedido comercial/convênio antes do processamento técnico
CREATE TABLE IF NOT EXISTS service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES service_catalog(id) ON DELETE RESTRICT,
  atendimento_tipo text NOT NULL DEFAULT 'normal' CHECK (atendimento_tipo IN ('normal', 'convenio')),
  payment_transaction_id text,
  payment_confirmed boolean NOT NULL DEFAULT false,
  comentarios_solicitacoes text,
  valor_servico numeric(12,2) NOT NULL DEFAULT 0,
  contribuicao_complementar numeric(12,2) NOT NULL DEFAULT 0,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  workflow_status text NOT NULL DEFAULT 'aguardando_pagamento'
    CHECK (workflow_status IN ('aguardando_pagamento', 'em_preenchimento', 'em_analise', 'em_processamento', 'concluido')),
  prazo_previsto timestamptz,
  process_id uuid REFERENCES processes(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_orders_org_id ON service_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_client_user_id ON service_orders(client_user_id);

-- 5) Marcação de checklist por pedido
CREATE TABLE IF NOT EXISTS service_order_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  checklist_item_id uuid NOT NULL REFERENCES service_checklist_items(id) ON DELETE RESTRICT,
  concluido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, checklist_item_id)
);

-- 6) Anexos por pedido e item de checklist
CREATE TABLE IF NOT EXISTS service_order_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  checklist_item_id uuid REFERENCES service_checklist_items(id) ON DELETE SET NULL,
  nome_arquivo text NOT NULL,
  url_arquivo text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7) Histórico técnico unificado
CREATE TABLE IF NOT EXISTS technical_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_id uuid REFERENCES processes(id) ON DELETE CASCADE,
  order_id uuid REFERENCES service_orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_technical_history_org_id ON technical_history(org_id);
CREATE INDEX IF NOT EXISTS idx_technical_history_process_id ON technical_history(process_id);
CREATE INDEX IF NOT EXISTS idx_technical_history_order_id ON technical_history(order_id);

-- 8) Colunas complementares no processo (sem alterar colunas existentes)
ALTER TABLE processes ADD COLUMN IF NOT EXISTS workflow_status text
  CHECK (workflow_status IN ('aguardando_pagamento', 'em_preenchimento', 'em_analise', 'em_processamento', 'concluido'));
ALTER TABLE processes ADD COLUMN IF NOT EXISTS comentarios_solicitacoes text;
ALTER TABLE processes ADD COLUMN IF NOT EXISTS prazo_previsto timestamptz;

