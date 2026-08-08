# Plano de melhorias do Kakebo

Este documento registra o roteiro acordado para aumentar a segurança, a consistência financeira, o desempenho e a qualidade do sistema. A implementação deve ser incremental, mantendo o produto utilizável entre as fases.

## Fase 0 — Preparação e linha de base

- Garantir build do backend e frontend.
- Configurar banco isolado para testes, Vitest, Supertest e CI.
- Documentar e testar os fluxos financeiros existentes.
- Executar build, lint, testes e `prisma validate` no CI.

## Fase 1 — Segurança e validação

- Garantir que contas, transações, categorias, subcategorias e orçamentos pertençam ao usuário autenticado.
- Centralizar consultas de propriedade para evitar acesso cruzado.
- Tornar `JWT_SECRET` obrigatório e remover qualquer segredo padrão.
- Aplicar o limitador específico ao login e cadastro.
- Normalizar e validar e-mails e senhas.
- Criar schemas Zod para todas as rotas.
- Limitar paginação, parcelas, descrições, arquivos e operações em lote.
- Testar isolamento entre usuários, autenticação e payloads inválidos.

## Fase 2 — Núcleo financeiro consistente

- Realizar cálculos monetários em centavos/Decimal.
- Distribuir corretamente diferenças de centavos entre parcelas.
- Centralizar o cálculo de impacto financeiro.
- Tornar criação de lançamentos e atualização de saldos atômicas.
- Usar incrementos/decrementos seguros para concorrência.
- Corrigir recorrências nos dias 29, 30 e 31.

## Fase 3 — Motor de cartões e faturas

- Centralizar ciclo aberto, ciclo fechado, competência e vencimento.
- Modelar faturas e pagamentos explicitamente.
- Relacionar as duas pontas de transferências por um identificador.
- Migrar dados históricos e eliminar regras baseadas em descrições.
- Cobrir pagamentos parciais, estornos, créditos e viradas de período.

## Fase 4 — Banco de dados e desempenho

- Adicionar unicidade de orçamento por usuário, subcategoria, mês e ano.
- Adicionar índices para consultas por usuário, conta, data e agrupamento.
- Definir enums e comportamentos `onDelete` no Prisma.
- Remover gravações do endpoint de listagem de contas.
- Executar filtros e paginação no banco, não em memória.

## Fase 5 — Frontend e experiência de uso

- Substituir `alert()` por feedback integrado.
- Exibir validações próximas aos campos.
- Detalhar competência, vencimento e saldo restante no pagamento de fatura.
- Separar limite utilizado, fatura aberta, fechada e pagamento pendente.
- Tipar respostas da API e reduzir o uso de `any`.
- Evitar duplo envio e melhorar estados de erro e carregamento.
- Migrar autenticação para cookie `HttpOnly` com proteção CSRF.

## Fase 6 — Observabilidade e manutenção

- Adicionar IDs de correlação e logs estruturados.
- Criar trilha de auditoria das operações financeiras.
- Evitar dados sensíveis em logs.
- Configurar métricas, backup, restauração e auditoria de saldos.

## Ordem de execução

1. Preparação e testes.
2. Segurança e isolamento por usuário.
3. Consistência monetária e atomicidade.
4. Motor e modelagem de faturas.
5. Integridade e desempenho do banco.
6. Experiência do frontend.
7. Observabilidade e operação.

## Status

- [x] Fase 0 — Preparação e linha de base
- [x] Fase 1 — Segurança e validação
- [x] Fase 2 — Núcleo financeiro consistente
- [x] Fase 3 — Motor de cartões e faturas
- [x] Fase 4 — Banco de dados e desempenho
- [x] Fase 5 — Frontend e experiência de uso
- [x] Fase 6 — Observabilidade e manutenção
