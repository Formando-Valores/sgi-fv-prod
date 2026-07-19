# Instruções para o opencode - SGI FV

Sempre responda em português do Brasil. Use português brasileiro em todas as suas interações, mensagens, resumos, explicações e pensamentos (thinking), a menos que o usuário peça explicitamente o contrário.

Mantenha respostas concisas e diretas. Não adicione prefácios ou explicações desnecessárias.

## Projeto SGI FV (Siga-FV)

Projeto de gerenciamento de processos jurídicos. Stack: React, TypeScript, Supabase, Vite.

- **Pasta raiz:** `D:\Projetos IA\Projeto Siga-FV`
- **Funções Edge:** `D:\Projetos IA\Projeto Siga-FV\supabase\functions`
- **Páginas:** `D:\Projetos IA\Projeto Siga-FV\pages`
- **Componentes:** `D:\Projetos IA\Projeto Siga-FV\src\components`
- **Libs:** `D:\Projetos IA\Projeto Siga-FV\src\lib`
- **Types:** `D:\Projetos IA\Projeto Siga-FV\types.ts`
- **Infra:** Supabase (auth, DB, edge functions, storage), Stripe (pagamentos), Vercel (deploy)

## Fluxo Automatizado de Registro (Filiação)

O projeto possui um fluxo de registro automatizado para novos usuários:
- **Registro cria automaticamente:** auth user + profile + org_members + process + sessão Stripe + envio de email de credenciais
- **Removidos:** Pendentes tab e PendingApprovals do AdminDashboard
- **Edge function create-user:** também cria sessão Stripe e envia email de boas-vindas
- **Chamada notify-pending-registration:** removida do Register.tsx

## Diário de Bordo

- Logs salvos em `docs/diario-opencode/sgi-fv/`
- Use o comando `salvar-dia-sigafv` (skill) ao final de cada sessão
