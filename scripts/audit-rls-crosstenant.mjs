#!/usr/bin/env node
/**
 * Auditoria de isolamento multi-tenant (RLS) — tarefa S-03 do Plano de Fecho V1.
 *
 * Autentica-se como um utilizador da organização A e tenta ler dados da
 * organização B em todas as tabelas com coluna org_id. Qualquer linha devolvida
 * é uma fuga de isolamento.
 *
 * Usa a chave ANON (nunca a service_role, que ignora RLS por definição e daria
 * um falso positivo de "tudo acessível").
 *
 * Uso:
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... \
 *   TENANT_A_EMAIL=... TENANT_A_PASSWORD=... TENANT_B_ORG_ID=... \
 *   node scripts/audit-rls-crosstenant.mjs
 *
 * As credenciais devem ser de utilizadores de TESTE, criados para este efeito.
 * Não usar contas reais de associados.
 */

import { createClient } from '@supabase/supabase-js';

const {
  VITE_SUPABASE_URL: URL,
  VITE_SUPABASE_ANON_KEY: ANON_KEY,
  TENANT_A_EMAIL,
  TENANT_A_PASSWORD,
  TENANT_B_ORG_ID,
} = process.env;

const missing = Object.entries({
  VITE_SUPABASE_URL: URL,
  VITE_SUPABASE_ANON_KEY: ANON_KEY,
  TENANT_A_EMAIL,
  TENANT_A_PASSWORD,
  TENANT_B_ORG_ID,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error(`Variáveis em falta: ${missing.join(', ')}`);
  process.exit(2);
}

/** Tabelas com coluna org_id que devem estar isoladas por tenant. */
const TENANT_TABLES = [
  'processes',
  'process_events',
  'process_messages',
  'process_document_attachments',
  'service_order_document_checklists',
  'payments',
  'payment_proofs',
  'financial_audit_events',
  'financial_audit_notifications',
  'org_financial_settings',
  'org_complementary_tiers',
  'org_stripe_config',
  'professional_payment_accounts',
  'professional_schedules',
  'org_members',
];

/** Tabelas de leitura pública assumida — reportadas como aviso, não como falha. */
const PUBLIC_BY_DESIGN = new Set(['services_catalog', 'organizations']);

const supabase = createClient(URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];

async function main() {
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: TENANT_A_EMAIL,
    password: TENANT_A_PASSWORD,
  });

  if (authError) {
    console.error(`Falha na autenticação do tenant A: ${authError.message}`);
    process.exit(2);
  }

  console.log(`Autenticado como ${TENANT_A_EMAIL} (uid ${auth.user.id})`);
  console.log(`A tentar aceder a dados da org ${TENANT_B_ORG_ID}\n`);

  for (const table of [...TENANT_TABLES, ...PUBLIC_BY_DESIGN]) {
    const { data, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: false })
      .eq('org_id', TENANT_B_ORG_ID)
      .limit(5);

    if (error) {
      // Erro de permissão é o resultado desejado; erro de schema é inconclusivo.
      const isPermission = /permission|policy|rls/i.test(error.message);
      results.push({
        table,
        status: isPermission ? 'BLOQUEADO' : 'INCONCLUSIVO',
        detail: error.message,
      });
      continue;
    }

    const leaked = data?.length ?? 0;
    if (leaked > 0) {
      results.push({
        table,
        status: PUBLIC_BY_DESIGN.has(table) ? 'PÚBLICO (esperado)' : 'FUGA',
        detail: `${leaked} linha(s) de outra org devolvidas`,
      });
    } else {
      results.push({ table, status: 'OK', detail: '0 linhas' });
    }
  }

  console.log('Tabela'.padEnd(38), 'Resultado'.padEnd(20), 'Detalhe');
  console.log('-'.repeat(100));
  for (const r of results) {
    console.log(r.table.padEnd(38), r.status.padEnd(20), r.detail);
  }

  await supabase.auth.signOut();

  const leaks = results.filter((r) => r.status === 'FUGA');
  const inconclusive = results.filter((r) => r.status === 'INCONCLUSIVO');

  console.log('');
  if (inconclusive.length) {
    console.log(`${inconclusive.length} tabela(s) inconclusiva(s) — verificar manualmente.`);
  }
  if (leaks.length) {
    console.error(`FALHOU: ${leaks.length} fuga(s) de isolamento multi-tenant.`);
    process.exit(1);
  }
  console.log('PASSOU: nenhuma fuga de isolamento detetada.');
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
