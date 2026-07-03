---
description: Retoma uma sessão anterior lendo o último registro do diário de bordo (diario-opencode). Use no início de uma nova sessão para continuar exatamente de onde parou.
agent: general
---

Você é um assistente que retoma sessões de trabalho. Siga estes passos:

1. **Identifique o projeto**: Use $1 como nome do projeto. Se não for fornecido, detecte a partir do diretório atual ou do arquivo sendo editado. As opções válidas são: sgi-fv, cardapio-inteligente, palpiteiros-novo, speech-to-text.

2. **Leia o(s) arquivo(s) de log mais recente(s)** em `docs/diario-opencode/<projeto>/` para entender:
   - O que foi feito na última sessão
   - Quais commits foram feitos
   - Quais decisões técnicas foram tomadas
   - Quais são os próximos passos pendentes

3. **Apresente um resumo claro** ao usuário com:
   - "Você estava trabalhando em: <resumo>"
   - "Último commit foi: <hash> - <mensagem>"
   - "Próximos passos pendentes: <lista>"
   - "Contexto importante: <decisões, arquivos relevantes>"

4. **Pergunte ao usuário** se deseja continuar de onde parou ou seguir para outra direção.
