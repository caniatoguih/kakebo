# Fase 4 do frontend — Estados de tela e primeiro uso

## Estado

Concluída.

## Primeira entrega

- Skeleton reutilizável para preservar a estrutura durante o carregamento.
- Skeletons específicos para cartões de contas e lista de lançamentos.
- Estado vazio reutilizável com explicação e chamada para ação.
- Primeiro uso de contas orienta o cadastro da primeira conta.
- Fluxo de caixa diferencia histórico vazio de busca sem resultados.
- Estados sem resultado oferecem “Limpar filtros” e “Nova transação”.
- Saldo total não é exibido como zero enquanto as contas ainda estão carregando.
- Checklist de configuração inicial no painel com progresso automático.
- Jornada orientada por atalhos: conta, categorias, orçamento e primeiro lançamento.
- A etapa de categorias só é concluída após o usuário abrir e revisar a tela; categorias padrão não contam como revisão.
- Sessão expirada informa o motivo do redirecionamento na tela de login.
- Falhas de conexão são identificadas como indisponibilidade temporária do serviço, separadas de ausência de dados.
- Skeletons aplicados às páginas de planejamento e categorias.
- Fluxo contábil vazio substituído por orientação e atalho para registrar movimentação.
- Gráfico mensal vazio substituído por orientação e chamadas para ação.
- Explicações dos quatro pilares Kakebo exibidas nos respectivos cartões.

## Validação

- Lint, 14 testes e build de produção executados no Docker.
