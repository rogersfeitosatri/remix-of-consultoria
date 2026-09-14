# Fluxo simples do acompanhamento

## Cinco entradas

| Entrada | Trabalho principal | Ações preservadas |
|---|---|---|
| Hoje | Próxima ação e retornos pessoais | Analisar check-in, agendar consulta, abrir tarefas |
| Atletas | Cadastro e situação de cada pessoa | Editar, enviar check-in, agendar, consultar respostas e renovar |
| Check-ins | Para analisar → preparar → aprovar → publicar/enviar | Programação manual, histórico, filtros, diagnóstico de falhas |
| Consultas | Semana, calendário, próximas e histórico | Agendamento manual, convite manual, disponibilidade e bloqueios |
| Financeiro | Pagamentos e vencimentos | Registrar pagamento, renovar, custos e relatórios |

Configurações reúne ferramentas secundárias. Planos alimentares antigos continuam
acessíveis para consulta; o planejamento atual acontece no Zona Nutri. Nenhuma
rota pública, regra de envio ou dado de atleta foi removido nesta reorganização.

## Estados que não podem ser confundidos

- Rascunho ou aprovação de feedback ainda exige ação do profissional.
- Envio exige registro de envio; publicação exige data e estado publicado.
- Encerrar sem feedback fecha a revisão, sem inventar envio.
- Concluir uma resposta só encerra tarefas ligadas ao ID daquela resposta.
- Histórico abre a resposta selecionada, preservando encerrados e inativos.
- Falha ao consultar feedbacks gera erro visível, não lista falsamente vazia.
- Contatos pessoais seguem sete dias para treino/ambos e 14 para dieta, separados
  da frequência de check-in. Ausência de registro não prova ausência de contato.

## Referência aplicada

Comparadas as skills Impeccable e
[UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).
Aplicadas desta última as orientações de navegação consistente, opções secundárias
recolhidas, foco visível, controles nomeados e alvos de toque maiores. Mantidos
componentes e identidade visual do aplicativo. Não há dependência da skill em produção.

## Validação

- Build Vite e verificação TypeScript.
- Testes de estados de feedback, paginação além de 500 respostas, falha de consulta,
  escopo por profissional, rotas, cadência de contato e projeção de calendário.
- Conferir no preview: cinco entradas; agendamento manual sem concluir cadastro;
  abrir uma resposta pelo histórico; voltar à aba anterior; conferir celular.
- A execução da mudança não envia mensagens, não altera planos e não migra o banco.

Reversão: reverter o commit de interface e republicar. Não há migração de dados a desfazer.
