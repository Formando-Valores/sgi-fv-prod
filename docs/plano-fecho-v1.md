# Plano de Fecho da V1 — SIGA-FV

**Versão:** 1.0
**Data:** 21/09/2026
**Responsável técnico:** Juan Segundo Sousa
**Base:** "Relatório Mestre de Histórico, Estado e Plano de Conclusão" (Leonardo S. Págio, v1.0, 20/09/2026)

---

## 0. Como ler este documento

O Relatório Mestre foi reconstruído a partir do histórico de WhatsApp e classifica as
funcionalidades como *"declaradas implementadas, devendo ser validadas"*. Este plano é o
passo seguinte que o próprio relatório pede: **substituir cada referência funcional pelo
caminho real no repositório `Formando-Valores/sgi-fv-prod`**.

Cada tarefa tem: ID, módulo, referência de código verificada, teste de aceite, evidência
obrigatória e estado. A partir daqui, **este ficheiro é a fonte única de verdade** — não o
WhatsApp.

### Estados

`ABERTO` · `EM DESENVOLVIMENTO` · `EM TESTE` · `PASS` · `FECHADO` · `BLOQUEADO`

### Divergências já apuradas contra o Relatório Mestre

Verificação feita no código em 21/09/2026. Três itens do checklist P0 do relatório
**não correspondem ao estado real**:

| Item do relatório | Estado declarado | Estado real verificado |
|---|---|---|
| P0 Termo de associado | ABERTO | **Implementado** — `supabase/functions/send-access-credentials/termoPdf.ts` gera o PDF, `accessEmail.ts` anexa. Falta apenas validar em produção. |
| P1 Autoabertura / retomada de pagamento | ABERTO | **Implementado** — `src/lib/paymentStatus.ts`, `src/lib/processes.ts`, `supabase/functions/create-client-process/index.ts`, `src/pages/Payments/PaymentCancel.tsx` |
| P0 Segurança | ABERTO | **Fase 1 concluída** no commit `e8f3e20` (19/08/2026). O restante continua aberto. |

E um item é **divergência de regra de negócio, não bug** — ver `F0-05`.

### Fora de escopo deste plano

O **Petição Global** não está neste repositório. Este plano cobre apenas o SIGA-FV.
As pendências do Petição Global (secções 4 e 5 do Relatório Mestre) precisam de um plano
próprio, depois de confirmado o acesso ao respetivo repositório.

---

## FASE 0 — Governança e congelamento (bloqueia todo o resto)

| ID | Tarefa | Referência | Resp. | Teste de aceite | Evidência | Estado |
|---|---|---|---|---|---|---|
| F0-01 | Criar tag de congelamento da V1 em produção | `git tag SIGA-FV-V1-PRODUCAO` | Juan | Tag existe e aponta para o commit em produção na Vercel | Hash do commit + output de `git tag` | ABERTO |
| F0-02 | Backup completo do Supabase (schema + dados) antes de qualquer alteração | `npx supabase db dump` | Juan | Dump restaurado com sucesso num projeto de teste | Ficheiro de dump + log do restore | ABERTO |
| F0-03 | Inventário de ambientes, contas e acessos | Supabase, Stripe, Vercel, GitHub, Abacus, e-mail/Resend | Leonardo + Juan | Tabela com: serviço, plano, titular, quem tem acesso, 2FA sim/não | Documento de inventário | ABERTO |
| F0-04 | Confirmar qual é o ambiente de produção real e qual o URL canónico | `api/stripe-webhook.js` refere `sgi-fv-prod.vercel.app` e `sgi-fv.vercel.app` | Leonardo + Juan | Um único domínio de produção declarado; os restantes removidos ou redirecionados | Print do painel Vercel | ABERTO |
| F0-05 | **DECISÃO DE NEGÓCIO:** registo automático vs. aprovação da Direção | Ver nota abaixo | **Leonardo** | Regra escrita e assinada | E-mail de confirmação | **BLOQUEADO — aguarda decisão** |

> **Nota F0-05 — conflito a resolver antes de programar.**
> O Relatório Mestre pede, como P0, implementar `pending_approval`
> (registo → aprovação da Direção → acesso → pagamento → certificado).
> Porém: (a) não existe nenhuma ocorrência de `pending_approval` no código, e
> (b) o `AGENTS.md` do repositório documenta que o fluxo de aprovação
> (aba *Pendentes* e `PendingApprovals` do `AdminDashboard`) foi **removido
> deliberadamente** a favor do registo automático, que hoje cria numa só operação:
> auth user + profile + org_members + process + sessão Stripe + e-mail de credenciais.
>
> Ou seja, a regra de negócio mudou em algum momento e ninguém fechou a decisão.
> Reimplementar a aprovação sem confirmação destruiria o fluxo atual, que está
> em produção. **Nenhuma tarefa do fluxo de filiação avança enquanto F0-05 estiver aberta.**

---

## FASE 1 — Segurança (P0 · não depende de terceiros · começa já)

Corresponde à Fase 4 do Relatório Mestre, atribuída a Juan. É a única frente que não
depende da disponibilidade do Germano nem da decisão F0-05.

| ID | Tarefa | Referência | Teste de aceite | Evidência | Estado |
|---|---|---|---|---|---|
| S-01 | Rotação de todas as credenciais que circularam em WhatsApp/e-mail | Abacus.AI, Stripe, Supabase, Vercel, GitHub, Resend | Credencial antiga deixa de autenticar | Registo de metadados da rotação (data, serviço, autor) — **nunca o valor** | ABERTO |
| S-02 | Contas individuais + 2FA para cada membro; fim das contas partilhadas | Todos os serviços do F0-03 | Cada pessoa autentica-se com conta própria; 2FA ativo | Print da lista de membros por serviço | ABERTO |
| S-03 | Auditoria de isolamento multi-tenant (RLS) | 56 migrations em `supabase/migrations/`, com foco em `002`, `021`, `022`, `045`, `047`, `056` | Criar 2 organizações de teste e tentar aceder a dados cruzados via API e via URL. **Zero fugas.** | Script de teste + output | ABERTO |
| S-04 | Auditar a cifra das chaves Stripe por organização | `supabase/migrations/052_org_stripe_config.sql` (`stripe_secret_key_encrypted`), `src/lib/stripeConfig.ts`, `STRIPE_CONFIG_ENCRYPTION_KEY` | Confirmar algoritmo, gestão da chave-mestra e que a chave nunca é devolvida ao browser (só `secret_key_last4`) | Relatório de revisão | ABERTO |
| S-05 | **Resolver a duplicação do webhook Stripe** | `api/stripe-webhook.js` (Vercel) **e** `supabase/functions/stripe-webhook/index.ts` (Edge) | Determinar qual está registado no painel Stripe; desativar/remover o outro | Print do painel Stripe + PR de remoção | ABERTO |
| S-06 | Remover código morto de credenciais | `constants.ts:28` — `ADMIN_CREDENTIALS: string[] = []`, já sem uso | `grep ADMIN_CREDENTIALS` não devolve nada | PR | ABERTO |
| S-07 | Verificar o salto na numeração das migrations (falta `049`) | `supabase/migrations/` — sequência 048 → 050 | Confirmar se o schema em produção corresponde às migrations do repositório | Diff schema produção vs. migrations | ABERTO |
| S-08 | Confirmar que os buckets de Storage são privados e usam signed URLs | `supabase/migrations/041_process_documents_bucket.sql`, `src/lib/paymentProofs.ts`, `src/lib/processDocuments.ts` | URL de documento sem token devolve 403 | Print do teste | ABERTO |
| S-09 | Ativar backups automáticos e testar restauro | Painel Supabase | Restauro concluído num projeto de teste | Log do restore | ABERTO |
| S-10 | Separar ambientes DEV / HOMOLOGAÇÃO / PRODUÇÃO | Supabase, Stripe (test/live), Vercel | Nenhuma chave `sk_live` fora de produção | Tabela de ambientes | ABERTO |

---

## FASE 2 — Infraestrutura de qualidade (habilita a "evidência" que o plano exige)

O Relatório Mestre exige, em cada item, *"teste de aceitação e evidência de conclusão"*.
Hoje isso é impossível de produzir de forma fiável: **o repositório não tem testes, não tem
CI e não tem sequer script de `typecheck` ou `lint`** (`package.json` tem apenas `dev`,
`build`, `preview`). Sem esta fase, todo o critério de aceite da secção 11 do relatório é
manual e não reproduzível.

| ID | Tarefa | Referência | Teste de aceite | Estado |
|---|---|---|---|---|
| Q-01 | Adicionar scripts `typecheck` e `lint` | `package.json` | `npm run typecheck` passa sem erros | ABERTO |
| Q-02 | CI no GitHub Actions: install + typecheck + build em cada PR | Criar `.github/workflows/ci.yml` (não existe `.github/`) | PR com erro de tipos fica vermelho | ABERTO |
| Q-03 | Testes E2E do fluxo crítico | Playwright; fluxo: registo → pagamento → acesso → certificado | Suite verde em ambiente de homologação | ABERTO |
| Q-04 | Monitorização de erros em produção | Sentry ou equivalente | Erro provocado aparece no painel em < 1 min | ABERTO |

---

## FASE 3 — P0 funcionais

| ID | Tarefa | Módulo / referência | Resp. | Teste de aceite | Estado |
|---|---|---|---|---|---|
| P0-01 | Serviços do Stripe sem valor associado | `src/lib/servicesCatalog.ts`, `servicesCatalogDb.ts`, `supabase/migrations/033`–`035`, `supabase/functions/stripe-create-checkout-session` | Juan | Selecionar serviço → ver preço correto → chegar ao checkout certo, para cada tipo de organização | ABERTO |
| P0-02 | Validar matriz RBAC por papel | `src/lib/permissions.ts`, `supabase/migrations/026_management_scope_authorization.sql`, `029_role_changer.sql` | Juan | Matriz admin/sénior/pleno/operador/cliente × módulo testada; cada papel vê só o permitido | ABERTO |
| P0-03 | Validar termo de associado no e-mail de acesso | `supabase/functions/send-access-credentials/termoPdf.ts` + `accessEmail.ts` | Juan | E-mail real recebido com PDF anexo, legível e com os dados corretos | **Implementado — VALIDAR** |
| P0-04 | Fluxo de aprovação da Direção | `pages/Register.tsx`, `supabase/functions/create-user` | — | Depende de `F0-05` | **BLOQUEADO** |
| P0-05 | Split de pagamento ao profissional | IBAN existe (`supabase/migrations/040_professional_payment_accounts.sql`, `src/lib/professionalAccounts.ts`, `IbanManagementSection.tsx`); **Stripe Connect não existe** — zero ocorrências de `stripe_account`/`transfer_data`/`application_fee` | Juan | Definir se é Stripe Connect ou repasse manual; se Connect, testar split real | ABERTO |
| P0-06 | Todos os formulários externos criam registo sem duplicação | `supabase/functions/wix-client-intake/`, `docs/integrations/wix-client-intake.md` | Juan | Testar formulário FV, AI e **vainaai** (declarado em falta em 13/07/2026); submeter 2× o mesmo e-mail e confirmar que não duplica | ABERTO |
| P0-07 | Certificado gerado, numerado e enviado automaticamente | `supabase/functions/send-certificate/`, `src/pages/Certificate/CertificatePage.tsx`, `supabase/migrations/050_profiles_certificate_fields.sql`, `053_org_certificate_config.sql` | Juan | Sequência controlada: pagamento confirmado → certificado gerado, numerado, guardado e enviado | VALIDAR |
| P0-08 | Corrigir remetente dos e-mails | `ACCESS_EMAIL_FROM` / `FROM_EMAIL` nas Edge Functions | Juan | E-mails saem de `contato@formandovalores.com` (apontado em 03/09/2026) | ABERTO |

---

## FASE 4 — P1 de experiência

| ID | Tarefa | Referência | Estado |
|---|---|---|---|
| P1-01 | Dashboard do cliente com linguagem orientada ao cliente ("Seu Cadastro", "Seu Processo", "Suas providências") | `src/pages/UnifiedDashboard.tsx`, `src/components/dashboard/blocks/ClientJourneyBlock.tsx`, `ClientProcessProgressPanel.tsx` | ABERTO |
| P1-02 | Agenda do cliente mostra profissionais conforme serviço/regras | `src/lib/professionalSchedules.ts`, `supabase/migrations/042`, `043`, `AgendaBlock.tsx` | ABERTO |
| P1-03 | Relatório de comunicação exportável (PDF com data, autor, anexos) | `src/lib/processMessages.ts`, `supabase/migrations/044_process_messages.sql`, `src/pages/Reports/ReportsPage.tsx` | PARCIAL |
| P1-04 | Suporte WhatsApp dentro do sistema com registo no audit trail | Hoje só existe texto/links em `pages/Register.tsx` e `accessEmail.ts` — **sem integração** | ABERTO |
| P1-05 | Onboarding contextual na primeira entrada | — | PARCIAL |
| P1-06 | Validação mobile/responsivo nos dispositivos-alvo | Todo o `src/components/dashboard/` | ABERTO |

---

## FASE 5 — Aceitação e release

| ID | Tarefa | Resp. | Critério |
|---|---|---|---|
| R-01 | UAT com utilizadores reais controlados | Leonardo, Carlos Alexandre, Juan | Cada caso com evidência, resultado, data e responsável |
| R-02 | Publicar release candidate `RC1` | Juan | Tag + notas de versão |
| R-03 | Checklist da secção 11 do Relatório Mestre 100% verde | Todos | Sem exceções em aberto |
| R-04 | Tag `RELEASE-1.0` + documentação de deploy e rollback | Juan | Procedimento de rollback testado |

---

## Sequência e dependências

```
F0 (governança) ──┬─► FASE 1 (segurança)  ─────────┐
                  │                                │
                  ├─► FASE 2 (qualidade/CI) ───────┤
                  │                                ├─► FASE 5 (UAT + release)
                  └─► F0-05 ─► FASE 3 (P0) ────────┤
                                     │             │
                                     └─► FASE 4 (P1)
```

As Fases 1 e 2 correm **em paralelo** com a espera pela decisão F0-05 e pela
disponibilidade do Germano. É isso que impede o projeto de parar outra vez.

## Nota sobre prazos

O Relatório Mestre propõe 9 fases em cerca de 8 dias. Esse calendário não é realista para
uma auditoria de segurança completa, testes E2E de todo o fluxo e correção de todos os P0.
Acresce que a Fase 5 do relatório (corrigir todos os P0) está atribuída ao Germano, que está
ausente — que é precisamente a razão da transição.

Proposta de calendário realista, a confirmar com a gestão:

| Fase | Esforço estimado | Depende de |
|---|---|---|
| Fase 0 | 2 dias | Leonardo (F0-03, F0-05) |
| Fase 1 | 1 a 2 semanas | — |
| Fase 2 | 1 semana | — |
| Fase 3 | 2 a 3 semanas | F0-05 |
| Fase 4 | 2 semanas | Fase 3 |
| Fase 5 | 1 semana | Tudo |

## Registo de alterações

| Data | Autor | Alteração |
|---|---|---|
| 21/09/2026 | Juan | Versão inicial. Mapeamento do Relatório Mestre contra o código real do repositório. |
