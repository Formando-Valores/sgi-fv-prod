# Diagnóstico — falha do deploy Vercel após a MISSÃO 002 (PR #113)

Data: 2026-11-05

## Sintoma
- Commit `3dcbaa4` (squash do PR #113) → estado Vercel `failure` ("Deployment has failed", `dpl_B2SJxdo4KTJttB2Tuxc7nPfPTspT`).
- As pré-visualizações do mesmo PR (`08cae84`, `6311724`) também falharam.
- O último deploy de produção bem-sucedido é `861d46f` (22/10/2026).

## O que foi verificado (reprodução local do build da Vercel)
| Verificação | Resultado |
|---|---|
| `rm -rf node_modules dist && npm ci` (npm 11 e npm 10.9.2, Node 22) | OK — 130 pacotes, lockfile sincronizado |
| `npm run build` (`vite build`) | OK — `✓ built` (~3 s) |
| `npm run typecheck` (`tsc --noEmit`) | OK — 0 erros |
| `npm test` (vitest) | OK — 3 ficheiros, 31 testes |
| GitHub Actions CI ("Typecheck e build") em `3dcbaa4` | `success` |
| `package-lock.json` | todos os `resolved` apontam para `registry.npmjs.org`; `vitest@3.2.7` existe no registo público; pacotes Linux x64 do rollup/esbuild presentes |
| Configuração Vercel no repositório | sem `vercel.json`; mesma deteção de projeto que nos deploys anteriores (`rootDirectory: null`) |

O diff `861d46f..3dcbaa4` só acrescenta ao frontend `vitest` (devDependency), `vitest.config.ts`, `tests/`, o componente `NotificationsBell.tsx` e pequenas alterações em `src/` — tudo compila sem erros. As Edge Functions (`supabase/functions/`) não fazem parte do build Vite.

## Conclusão (hipótese mais provável)
O código **não** reproduz nenhum erro de build. Além disso, a Vercel marcou a falha **cerca de 1–4 segundos** depois do push (comentário do bot e estado `failure` no mesmo segundo em que o deploy foi criado), tempo insuficiente para clonar, instalar dependências e compilar. Isto indica uma **rejeição antes do build** do lado da Vercel (conta/equipa/projeto), por exemplo:
- o autor Git dos commits (`germanoreis2024-coder`) não ter (ou ter deixado de ter) permissão para criar deploys na equipa Vercel `carlos-alexandre-cirilos-projects` — todos os deploys bem-sucedidos desde setembro foram de commits do autor `Juanse1998`, e todos os que falharam são de `germanoreis2024-coder`;
- ou um limite/bloqueio da conta Vercel (plano, quota de deploys).

**REQUER AUTORIZAÇÃO HUMANA** — confirmar no painel Vercel (ou com `npx vercel inspect dpl_B2SJxdo4KTJttB2Tuxc7nPfPTspT --logs`, com sessão do dono da equipa) a mensagem exata e, se for permissão do autor, adicionar o utilizador à equipa ou fazer **Redeploy** de `main` a partir do painel pelo dono da conta.
