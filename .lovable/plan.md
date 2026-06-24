## Objetivo
Atletas conversam pelo WhatsApp e recebem respostas de uma IA (Lovable AI / GPT-5) baseadas 100% no plano deles — anamnese, plano alimentar atual e check-ins recentes. Casos sensíveis viram alerta no Centro de Ações e notificação no seu WhatsApp.

## O que você precisa fazer (fora da Lovable)

1. **Criar app na Meta for Developers** (business.facebook.com → Apps → WhatsApp).
2. **Número dedicado** ligado à conta WhatsApp Business (não pode ser o mesmo que você usa no Z-API hoje).
3. Obter e me passar (via add_secret quando eu pedir):
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_ACCESS_TOKEN` (token permanente do System User)
   - `WHATSAPP_VERIFY_TOKEN` (string aleatória que você inventa — usada no webhook)
   - `WHATSAPP_APP_SECRET` (para validar assinatura dos webhooks)
4. **Configurar webhook** no painel Meta apontando para a Edge Function que eu vou criar (vou te passar a URL exata).
5. **Aprovar 1 template** "boas-vindas / opt-in" na Meta (obrigatório para iniciar conversa fora da janela de 24h).

## O que eu implemento aqui

### Backend
- Tabela `ai_chat_conversations` (1 por atleta) + `ai_chat_messages` (histórico role/content/tokens) com RLS escopada por `user_id` do treinador.
- Tabela `ai_chat_settings` (system prompt editável, modelo, on/off por atleta, palavras-gatilho de escalonamento).
- Edge Function `whatsapp-webhook` (verify_jwt=false, valida assinatura Meta):
  - GET → handshake `hub.challenge`.
  - POST → recebe mensagem, identifica atleta pelo telefone E.164, carrega contexto (anamnese + plano + últimos 3 check-ins), monta prompt e chama Lovable AI (`openai/gpt-5-mini` por padrão).
  - Detecta gatilhos sensíveis (sintomas clínicos, pedido de mudança de plano, palavras como "dor", "passando mal", "trocar plano") → cria registro em `ai_chat_escalations` (vira card no Centro de Ações) e dispara WhatsApp para o admin via Z-API existente.
  - Responde ao atleta via Meta Cloud API.
- Edge Function `whatsapp-send` (envio ativo Cloud API, usada se você quiser iniciar conversa).
- Janela 24h respeitada: fora dela, usa template aprovado.

### Frontend
- Página **IA Assistente WhatsApp** em Configurações:
  - Toggle on/off global.
  - System prompt editável (tom, escopo, "fale sempre como nutricionista do Rogers", etc.).
  - Lista de palavras-gatilho de escalonamento (editável).
  - Logs de conversas por atleta (busca + visualização do thread).
- Em cada **ficha de atleta**: toggle "Habilitar IA WhatsApp para este atleta" + ver histórico da conversa.
- Novo card no **Centro de Ações**: "Mensagens IA pendentes de revisão" com link pro thread.

### Escopo do contexto enviado à IA (por mensagem)
- Nome, idade, objetivo (da anamnese).
- Plano alimentar atual (texto do último plano).
- Últimos 3 check-ins (peso, sensações, aderência).
- Pergunta atual + últimas 10 trocas da conversa.

### Limites
- IA **nunca** altera plano — só orienta com base no que está escrito.
- Se atleta pedir mudança → resposta padrão "vou avisar o Rogers" + escalonamento.
- Custo controlado: GPT-5-mini por padrão, ~poucos centavos por resposta.

## Ordem de execução
1. Você confirma o plano.
2. Eu crio as tabelas + Edge Functions + UI.
3. Eu te peço os 4 secrets via add_secret.
4. Você cria o app Meta, cola a URL do webhook que eu te passar, e aprova o template.
5. Testamos com 1 atleta piloto.

Posso seguir?