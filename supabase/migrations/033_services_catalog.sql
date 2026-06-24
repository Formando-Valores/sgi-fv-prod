-- ============================================
-- SGI FV - Migration 033: Services Catalog
-- ============================================

CREATE TABLE IF NOT EXISTS public.services_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  unit text NOT NULL CHECK (unit IN ('ADMINISTRATIVO', 'JURÍDICO / ADVOCACIA', 'TECNOLÓGICO / AI')),
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.services_catalog (org_id, name, description, unit, price) VALUES
  (NULL, 'Registro de Empresa', 'Registro e abertura de empresa junto à junta comercial', 'ADMINISTRATIVO', 2500.00),
  (NULL, 'Alteração Contratual', 'Alteração de contrato social', 'ADMINISTRATIVO', 1800.00),
  (NULL, 'Certidão Negativa', 'Emissão de certidão negativa de débitos', 'ADMINISTRATIVO', 500.00),
  (NULL, 'Abertura de Filial', 'Registro e abertura de filial', 'ADMINISTRATIVO', 3000.00),
  (NULL, 'Assessoria Administrativa Mensal', 'Assessoria administrativa recorrente', 'ADMINISTRATIVO', 800.00),
  (NULL, 'Consultoria Jurídica', 'Consultoria jurídica especializada', 'JURÍDICO / ADVOCACIA', 1200.00),
  (NULL, 'Análise/Elaboração de Contrato', 'Análise ou elaboração de contrato', 'JURÍDICO / ADVOCACIA', 2000.00),
  (NULL, 'Ação Judicial', 'Ação judicial em qualquer instância', 'JURÍDICO / ADVOCACIA', 5000.00),
  (NULL, 'Defesa Administrativa', 'Defesa em processo administrativo', 'JURÍDICO / ADVOCACIA', 3500.00),
  (NULL, 'Parecer Jurídico', 'Elaboração de parecer jurídico', 'JURÍDICO / ADVOCACIA', 1500.00),
  (NULL, 'Mediação/Conciliação', 'Sessão de mediação ou conciliação', 'JURÍDICO / ADVOCACIA', 2200.00),
  (NULL, 'Desenvolvimento Web', 'Criação de site ou sistema web', 'TECNOLÓGICO / AI', 5000.00),
  (NULL, 'Aplicativo Mobile', 'Desenvolvimento de aplicativo mobile', 'TECNOLÓGICO / AI', 8000.00),
  (NULL, 'Consultoria em IA', 'Consultoria em inteligência artificial', 'TECNOLÓGICO / AI', 3500.00),
  (NULL, 'Automação de Processos', 'Automação de processos empresariais', 'TECNOLÓGICO / AI', 4500.00),
  (NULL, 'Manutenção de Sistema', 'Manutenção corretiva/evolutiva de sistema', 'TECNOLÓGICO / AI', 2000.00),
  (NULL, 'Infraestrutura Cloud', 'Projeto e implantação de infraestrutura cloud', 'TECNOLÓGICO / AI', 6000.00)
ON CONFLICT DO NOTHING;

ALTER TABLE public.services_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver catalogo"
  ON public.services_catalog FOR SELECT
  USING (true);
