# Fase 6 do frontend — Acessibilidade e design system

## Estado

Em andamento.

## Primeiro bloco concluído

- Tokens de contraste do tema claro ajustados para textos secundários, ações e estados positivos.
- Foco visível dos botões reforçado com anel de 2 px e separação do fundo.
- Botões essenciais padronizados com área mínima de toque de 44 × 44 px.
- Botões representados apenas por ícones revisados com nome acessível e dica textual.
- Controles de período do Dashboard e Planejamento identificados para leitores de tela.
- Navegação lateral e mobile revisada para contraste e tamanho mínimo de texto.
- Preferência `prefers-reduced-motion` respeitada globalmente.
- Auditoria Axe transformada em barreira do CI para violações críticas ou graves.
- Jornada E2E cobre abertura e fechamento do modal de transação por teclado, confinamento inicial e retorno de foco.
- Jornada E2E bloqueia avisos de React, Radix, chaves ausentes e alternância entre componentes controlados e não controlados.

## Resultado da validação

- Auditoria inicial no Dashboard: 2 categorias de violação em desktop e mobile (`button-name` e `color-contrast`).
- Auditoria após as correções: 0 violações em desktop e 0 em mobile.
- E2E de acessibilidade e teclado: 2 jornadas aprovadas.
- Testes de componentes: 18 aprovados.
- Lint, build PWA e limites de bundle aprovados no Docker.

## Próximo bloco

- Exercitar por teclado os formulários completos de receita, despesa, transferência e filtros.
- Consolidar padrões reutilizáveis de cabeçalho, seletor de período e ações de ícone.

## Segundo bloco concluído

- Auditoria Axe ampliada para Dashboard, Fluxo de Caixa, Planejamento, Contas, Categorias e Visão Contábil.
- Modais de nova transação e nova conta incluídos na barreira automatizada.
- Associações entre `Label` e seletores Radix corrigidas nos formulários de transação e conta.
- `Input` e `SelectTrigger` padronizados com 44 px de altura mínima e foco visível reforçado.
- Contraste dos filtros da Visão Contábil e do resumo de Contas corrigido.
- Resultado: 16 auditorias sem violações críticas ou graves, considerando desktop e mobile.

## Terceiro bloco concluído

- Filtros do Fluxo de Caixa, importador CSV e modal de novo orçamento adicionados à auditoria automatizada.
- Filtros receberam associação de rótulos, estado expandido e foco visível.
- Campos das etapas de mapeamento e revisão do CSV receberam nomes acessíveis por linha.
- Campos dinâmicos do sincronizador OFX receberam rótulos e nomes acessíveis.
- Pagamento de fatura e desenho de orçamento tiveram associações de campos revisadas.
- 55 ocorrências de texto funcional com 9–11 px foram padronizadas para o mínimo de 12 px.
- Contraste dos avisos do importador CSV corrigido.
- Resultado ampliado: 22 auditorias sem violações críticas ou graves em desktop e mobile.
- Jornada desktop aprovada em 42,4 s e jornada mobile aprovada em 49,7 s no Docker.
