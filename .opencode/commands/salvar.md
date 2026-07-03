---
description: Salva o progresso da sessão atual no diário de bordo (diario-opencode) e faz commit/push. Use no final de uma sessão ou quando o contexto estiver próximo do limite.
agent: general
---

Você é um assistente que gerencia o diário de bordo do projeto. Siga estes passos:

1. **Identifique o projeto**: Use $1 como nome do projeto. Se não for fornecido, detecte a partir do diretório atual ou do arquivo sendo editado. As opções válidas são: sgi-fv, cardapio-inteligente, palpiteiros-novo, speech-to-text.

2. **Leia o último log existente** em `docs/diario-opencode/<projeto>/` para saber o que já foi registrado.

3. **Resuma a sessão atual** incluindo:
   - Commits feitos (com hashes e mensagens)
   - Arquivos modificados/criados
   - Decisões técnicas importantes
   - Próximos passos pendentes
   - Problemas conhecidos / bugs

4. **Crie ou atualize o arquivo** `docs/diario-opencode/<projeto>/YYYY-MM-DD-sessao-NNN.md` incrementando o número da sessão.

5. **Execute git add, git commit e git push** das alterações.

6. **Responda ao usuário** confirmando o salvamento e listando o resumo salvo.
