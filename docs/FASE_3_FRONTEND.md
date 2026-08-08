# Fase 3 do frontend — Feedback e prevenção de erros

## Estado

Concluída.

## Primeira entrega

- Diálogo destrutivo reutilizável com descrição clara do impacto.
- Confirmação reforçada pelo nome ao excluir uma conta.
- Remoção das confirmações nativas em lançamentos, contas, categorias e recorrências.
- Estado de processamento padronizado no diálogo de confirmação.
- Mensagens de sucesso após exclusões concluídas.
- Fila de notificações com variantes de sucesso, informação, aviso e erro.
- Suporte a múltiplas notificações simultâneas sem perda de mensagens.
- Estado de erro reutilizável com ação “Tentar novamente” e indicação de nova tentativa.
- Recuperação explícita nas consultas de painel, contas, categorias, planejamento, fluxo contábil, faturas e desenho de orçamento.
- Atualização otimista ao alterar status, com restauração automática quando a API falha.
- Ação “Desfazer” para alteração de status, por ser uma operação reversível e segura.
- Erros de formulário associados aos campos com `aria-invalid`, `aria-describedby` e anúncio por leitor de tela.
- Padronização inicial aplicada em autenticação, cadastro, transações, contas, subcategorias e orçamento.

## Melhorias futuras

- Ampliar testes dos diálogos destrutivos nos fluxos de página.

## Validação

- Lint, 10 testes unitários e build de produção executados no Docker.
- Todos os formulários de envio bloqueiam submissões duplicadas e comunicam o processamento.
