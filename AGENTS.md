# Instruções para o opencode

Sempre responda em português do Brasil. Use português brasileiro em todas as suas interações, mensagens, resumos, explicações e pensamentos (thinking), a menos que o usuário peça explicitamente o contrário.

Mantenha respostas concisas e diretas. Não adicione prefácios ou explicações desnecessárias.

## Projeto de Ensino Java

Existe um projeto de ensino de Java em andamento neste workspace.
- **Arquivo de acompanhamento:** `D:\Projetos IA\Roteiro Java - Head First.md`
- **Livro base:** "Use a Cabeça Java" (Head First Java) - PDF em `D:\Livros\USE A CABEÇA JAVA PDF.pdf`
- **Sempre que iniciar uma sessão**, ler o arquivo `Roteiro Java - Head First.md` para saber em qual aula parou
- O MD contém 18 aulas, resumos teóricos, código prático e exercícios
- Atualizar o status da aula no MD ao concluir
- Ao comprimir sessão, incluir no resumo: qual aula foi concluída, qual é a próxima, e conceitos-chave ensinados

## Fluxo Automatizado de Registro (Filiação)

O projeto possui um fluxo de registro automatizado para novos usuários:
- **Registro cria automaticamente:** auth user + profile + org_members + process + sessão Stripe + envio de email de credenciais
- **Removidos:** Pendentes tab e PendingApprovals do AdminDashboard
- **Edge function create-user:** também cria sessão Stripe e envia email de boas-vindas
- **Chamada notify-pending-registration:** removida do Register.tsx
