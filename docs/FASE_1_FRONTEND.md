# Fase 1 do frontend — Lançamentos financeiros orientados

## Resultado

A criação de lançamentos passou a começar pela intenção do usuário: despesa, receita ou transferência. O formulário apresenta apenas os campos aplicáveis ao tipo selecionado e descreve o efeito financeiro da operação.

## Entregas

- Escolha inicial por cartões de despesa, receita e transferência.
- Linguagem contextual para conta de origem e conta de destino.
- Saldo atual exibido nas opções de conta.
- Bloqueio de origem e destino iguais no frontend e backend.
- Resumo da transferência antes da confirmação.
- Projeção dos saldos após uma transferência efetivada.
- Aviso quando o envio deixará a conta de origem negativa.
- Subcategoria, parcelamento e recorrência ocultados quando não se aplicam.
- Rodapé de ações persistente em telas pequenas.
- Dados mantidos no formulário quando a API retorna erro.
- Feedback integrado após criação ou edição.
- Edição agrupada de transferência com origem e destino preenchidos.
- Edição e exclusão atualizam ou removem as duas pontas e corrigem ambos os saldos atomicamente.

## Validação

- Testes de componente para despesa, criação de transferência e abertura da edição agrupada.
- Teste integrado com PostgreSQL para criar, editar e excluir transferência.
- Conferência dos saldos das duas contas após cada operação.
- Lint, testes e build executados no Docker.
