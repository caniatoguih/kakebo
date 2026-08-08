# Fase 5 do frontend — Navegação e arquitetura da informação

## Estado

Concluída.

## Primeira entrega

- Navegação inferior mobile para Reflexão, Fluxo de Caixa, Planejamento e Contas.
- Destino atual indicado por cor e `aria-current`.
- Cabeçalho mobile informa explicitamente a localização atual.
- Menu lateral preserva todos os destinos e inclui descrições de finalidade.
- “Orçamento” renomeado para “Planejamento”.
- “Contas” apresentado como “Contas e Cartões”.
- “Fluxo Contábil” renomeado para “Visão Contábil”.
- Descrição da Visão Contábil diferencia análise consolidada do registro de lançamentos no Fluxo de Caixa.
- Indicadores de orçamento e realizado na Reflexão abrem seus detalhes preservando o mês.
- Planejamento lê e atualiza o mês na URL, inclusive ao navegar entre meses.
- Cada conta ou cartão possui atalho para o Fluxo de Caixa filtrado pela conta.
- Cada fatura mensal abre seus lançamentos filtrados por cartão e competência.
- Itens do planejamento abrem despesas filtradas pela subcategoria e pelo mesmo mês.
- API de lançamentos suporta filtro paginado por subcategoria.

## Validação final

- Teste end-to-end ampliado para validar as nomenclaturas do menu desktop.
- Barra inferior, localização atual e destino ativo validados no viewport móvel.
- Atalho da Reflexão para o Planejamento validado com preservação do mês na URL.
- Ausência de rolagem horizontal validada no Fluxo de Caixa móvel.
- Cenários desktop e mobile aprovados no Chromium pelo Docker.
- A auditoria de linha de base registrou pendências de nome acessível em botões e contraste para tratamento na fase 6.

## Validação

- Lint, 15 testes de componentes e build de produção aprovados no Docker.
- 2 jornadas end-to-end aprovadas no Docker: desktop e mobile.
