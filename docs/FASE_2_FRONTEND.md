# Fase 2 do frontend — Fluxo de caixa responsivo

## Resultado

A listagem de lançamentos agora possui uma experiência específica para telas pequenas, filtros persistentes e paginação no banco. Transferências relacionadas são apresentadas como uma única operação com origem e destino.

## Entregas

- Cartões agrupados por data no mobile e tabela no desktop.
- Transferências unificadas em uma linha ou cartão.
- Nome da conta de origem e destino na transferência.
- “Nova Transação” como ação primária.
- CSV e OFX agrupados no menu secundário “Importar”.
- Filtros persistidos na URL.
- Chips removíveis para filtros ativos e ação “Limpar filtros”.
- Quantidade de resultados e página atual visíveis.
- Paginação de 25 itens processada no PostgreSQL.
- Busca, status, conta e período processados no backend.
- Limite máximo da API reduzido para 100 itens por página.
- Ações em lote adaptadas para telas pequenas.
- Estado de erro com ação “Tentar novamente”.

## Validação

- Lint e testes do backend e frontend.
- Build de produção dentro do Docker.
- Teste integrado com PostgreSQL isolado.
- Verificação visual desktop e mobile pela suíte Playwright.
