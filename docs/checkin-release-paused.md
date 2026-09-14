# Check-ins: publicação com saídas pausadas

O formulário confirma telefone ou e-mail dentro do convite, carrega a versão congelada retornada pela API e grava pela RPC atômica. O painel relaciona respostas por dispatch_id. A agenda usa ciclos fixos de 7, 14 ou 28 dias a partir da referência, sempre arredondando para a segunda-feira seguinte.

O processador está publicado com OUTBOUND_PAUSED=true. Simulação não cria dispatches nem chama provedores. Nenhum cron foi ativado. A liberação de envio exige uma tarefa explícita de homologação dos provedores; não basta configurar secrets. Confirmação de aceitação pelo provedor não prova entrega ou leitura.

A função send-whatsapp em produção tem proteções adicionais que não estão no arquivo legado deste repositório. Ela não foi sobrescrita. Não fazer deploy global das funções legadas.

O endpoint de e-mail valida autenticação e dono do destinatário, mas permanece bloqueado: o provedor e domínio da integração antiga ainda precisam ser migrados. Não foi publicado worker nem alimentada a fila antiga. O canal de e-mail permanece preservado no planejamento.

As alterações da migration restore_public_checkin_flow já estavam aplicadas. As migrations seguintes complementam a agenda, limitam a sincronização à ocorrência exata e permitem reservar um dispatch ainda sem sent_at, preservando o default usado por chamadas legadas. Dados históricos e cancelamentos intencionais foram preservados. Alterações de agenda ficam registradas em checkin_configuration_changes.

Validação em 14/09/2026: 14 cenários HTTP nas funções publicadas, incluindo telefone, e-mail, versão, dados inválidos, nota zero, duplicidade, concorrência e prazo. Foram criadas exatamente duas respostas do cadastro técnico descartável; ambas ficaram visíveis ao dono sob RLS, e indisponíveis para anon. Somente a ocorrência exata ficou completed. Fixture e eventos técnicos removidos, zero logs de WhatsApp/e-mail, zero cron ativo.

Após recuperar o navegador e o usuário entrar como administrador, o fluxo visual foi validado em produção: abertura do convite, identidade por e-mail, campos obrigatórios, nota zero, gravação, mensagem de duplicidade e prazo encerrado. A resposta foi aberta na revisão administrativa, incluindo a nota zero e o texto técnico. O histórico de envios associou somente o convite respondido; os outros dois permaneceram pendentes. Nenhum botão de envio externo foi acionado.

Testes locais: `npm run build`, `npm exec -- tsc --noEmit -p tsconfig.app.json`, `npm test`; funções: `deno check --node-modules-dir=none supabase/functions/process-checkin-dispatches/index.ts supabase/functions/verify-checkin-phone/index.ts supabase/functions/submit-public-checkin/index.ts supabase/functions/send-transactional-email/index.ts`; testes de cadência/validação: `deno test --node-modules-dir=none tests/checkin/`.
