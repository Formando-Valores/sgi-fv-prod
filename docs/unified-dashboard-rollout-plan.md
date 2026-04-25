# Plano de rollout seguro — Unificação do Dashboard

## Objetivo
Executar a migração para `UnifiedDashboard` com baixo risco operacional, proteção de experiência para clientes e capacidade de rollback imediato em todas as fases.

## Princípios de segurança
- **Parallel run primeiro**: nova experiência coexistindo com dashboards atuais.
- **Feature flag por perfil**: habilitação progressiva e controlada.
- **Gates de entrada/saída por fase**: só avançar com critérios de sucesso definidos.
- **Observabilidade obrigatória**: monitoramento técnico e de produto antes de ampliar exposição.
- **Rollback simples**: volta rápida para o dashboard antigo sem deploy corretivo.

## Fase 1 — Implementar `UnifiedDashboard` em paralelo (sem remover legados)

### Escopo
- Garantir `UnifiedDashboard` funcional em rota/entrada isolada.
- Manter `AdminDashboard` e `UserDashboard` sem alterações comportamentais para produção.
- Isolar integrações comuns (cards, blocos, navegação, carregamento de dados) para reduzir divergência.

### Entregáveis
- Componente `UnifiedDashboard` pronto para uso em produção “dark” (não exposto a clientes finais por padrão).
- Logs/telemetria mínimos de carregamento, erro e tempo de render inicial.
- Checklist de paridade funcional por perfil (admin/sênior/cliente).

### Critérios de saída
- Testes críticos de navegação e carregamento passando.
- Erro em runtime sem aumento relevante vs baseline dos dashboards atuais.
- Sem regressões conhecidas em autenticação e autorização.

### Rollback
- Não aplicável para usuário final (fase sem exposição ampla); manter caminhos antigos como padrão.

---

## Fase 2 — Ativar via feature flag para perfis internos (admin/sênior)

### Estratégia
- Criar flag: `dashboard_unificado_internal`.
- Regra inicial: habilitada apenas para perfis internos (`admin`, `senior`).
- Exposição gradual:
  1. Time técnico interno.
  2. Operação/negócio interno.
  3. 100% dos internos elegíveis.

### Métricas a acompanhar
- Taxa de erro JS e API por sessão.
- Tempo de carregamento inicial (p50/p95).
- Taxa de abandono da tela e falha de ações principais.
- Feedback qualitativo interno (usabilidade, consistência, gaps).

### Critérios de saída
- Estabilidade por janela mínima (ex.: 5–7 dias úteis sem incidente severo).
- Indicadores iguais ou melhores que o dashboard antigo para internos.
- Backlog de bugs críticos zerado.

### Rollback
- Desligar `dashboard_unificado_internal` globalmente.
- Reencaminhar internos automaticamente para dashboard legado.

---

## Fase 3 — Migrar clientes para painel integrado e validar escopo

### Estratégia
- Nova flag para cliente: `dashboard_unificado_clients`.
- Rollout progressivo por ondas:
  1. Piloto (ex.: 5–10% dos clientes ou cohort específico).
  2. Expansão controlada (25% → 50% → 100%).
- Validar escopo funcional obrigatório por segmento (financeiro, processos, alertas, histórico, ações rápidas).

### Guardrails de produto
- Não remover rotas antigas até estabilização total.
- Canal de suporte com triagem específica para issues do painel unificado.
- Registro de incidentes com classificação: bloqueante, alto, médio, baixo.

### Critérios de saída
- KPIs de uso e sucesso de tarefas principais estáveis/melhores que baseline.
- Taxa de suporte sem aumento anormal após 2 ciclos de expansão.
- Validação formal de escopo por produto + operação.

### Rollback
- Reduzir percentual da flag para 0% e retornar cohorts para dashboard legado.
- Preservar estado/sessão para evitar perda de contexto do usuário.

---

## Fase 4 — Remover `UserDashboard` antigo após estabilização

### Pré-requisitos
- `dashboard_unificado_clients` em 100% com estabilidade comprovada.
- Sem bug crítico aberto relacionado ao fluxo principal de cliente.
- Janela de observação pós-100% concluída (ex.: 2 semanas).

### Execução
- Redirecionar rotas do cliente para `UnifiedDashboard` de forma definitiva.
- Tornar `UserDashboard` inacessível por configuração.
- Manter branch/tag de segurança para recuperação emergencial.

### Critérios de saída
- Nenhum tráfego útil em rotas antigas.
- Erros e satisfação estáveis após remoção lógica.

### Rollback
- Reverter commit/flag de redirecionamento final.
- Reativar rota antiga temporariamente, se necessário.

---

## Fase 5 — Limpeza de legado e tipos duplicados

### Escopo de limpeza
- Remover código morto de `UserDashboard`.
- Consolidar tipos compartilhados (evitar duplicações entre dashboards).
- Eliminar utilitários e componentes não usados.
- Atualizar testes e documentação técnica final.

### Critérios de saída
- Build limpa sem warnings relevantes de tipos/imports órfãos.
- Cobertura de testes críticos mantida.
- Documentação de arquitetura atualizada para o estado final.

### Rollback
- Não há rollback funcional esperado (somente limpeza).
- Em caso de regressão inesperada, restaurar arquivos removidos via git revert.

---

## Governança por fase (recomendado)
- **Ritual fixo de go/no-go** com Eng + Produto + Operação.
- **Dono da fase** definido (responsável por aprovação de avanço).
- **Checklist de saída padronizado** com evidências (métricas, bugs, feedback).
- **Plano de comunicação** para times internos e suporte a cada mudança de onda.

## Cronograma sugerido (referência)
- Fase 1: 1 sprint.
- Fase 2: 1 sprint.
- Fase 3: 1–2 sprints (dependendo de volume e risco do cliente).
- Fase 4: 0,5 sprint.
- Fase 5: 0,5 sprint.

> Total estimado: 4–5 sprints com mitigação de risco e rollback controlado.
