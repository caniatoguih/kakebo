# Plano de melhorias de usabilidade do frontend

## Objetivo

Evoluir o frontend do Kakebo para que os fluxos financeiros sejam fáceis de entender, seguros contra erros e eficientes em desktop e dispositivos móveis. A implementação deve ser incremental e preservar o funcionamento do sistema entre as fases.

## Princípios

- Usar linguagem financeira clara, sem exigir conhecimento contábil.
- Mostrar apenas os campos e ações necessários em cada contexto.
- Prevenir erros antes do envio e explicar como corrigi-los.
- Manter ações essenciais acessíveis por teclado e toque.
- Dar feedback imediato para carregamento, sucesso, falha e ausência de dados.
- Validar cada fase com testes automatizados e no Docker.

## Métricas de acompanhamento

- Tempo e quantidade de interações para registrar receita, despesa e transferência.
- Taxa de erros de validação e de abandono dos formulários.
- Quantidade de tentativas duplicadas de envio.
- Tempo de carregamento percebido das páginas principais.
- Percentual de fluxos essenciais concluídos em tela de 360 px sem rolagem horizontal.
- Resultado de auditorias de acessibilidade e quantidade de avisos no console.

## Fase 0 — Linha de base de UX

### Entregáveis

- Inventariar páginas, modais, ações primárias e estados possíveis.
- Registrar capturas das principais telas em desktop e mobile.
- Mapear as jornadas: primeiro acesso, lançamento, transferência, pagamento de fatura, importação e orçamento.
- Adicionar testes dos fluxos críticos com React Testing Library.
- Preparar testes end-to-end para desktop e viewport móvel.
- Registrar medidas iniciais de acessibilidade, desempenho e tamanho dos bundles.

### Critérios de aceite

- Jornadas críticas e problemas conhecidos documentados.
- Testes cobrindo ao menos criação de despesa e transferência.
- Linha de base reproduzível no Docker e no CI.

## Fase 1 — Lançamentos financeiros orientados

### Entregáveis

- Iniciar o formulário pela escolha entre receita, despesa e transferência.
- Exibir somente os campos aplicáveis ao tipo selecionado.
- Usar rótulos claros: “Conta que paga” e “Conta que recebe”.
- Exibir saldo e tipo ao lado das contas selecionáveis.
- Impedir origem e destino iguais.
- Mostrar resumo do impacto antes de confirmar uma transferência.
- Ocultar subcategoria, parcelamento e recorrência quando não forem aplicáveis.
- Preservar os dados preenchidos quando ocorrer erro da API.
- Tratar edição e exclusão das duas pontas de uma transferência como uma única operação.
- Manter a ação de salvar visível em telas pequenas.

### Critérios de aceite

- Receita, despesa e transferência podem ser registradas sem campos ambíguos.
- A transferência apresenta claramente origem, destino e impacto nos saldos.
- Nenhum envio duplicado é possível durante o processamento.
- Testes unitários e de integração cobrem os três tipos de lançamento.

## Fase 2 — Fluxo de caixa responsivo

### Entregáveis

- Manter tabela no desktop e criar cartões de lançamentos no mobile.
- Agrupar lançamentos por data ou competência.
- Exibir transferências como uma operação única com origem e destino.
- Destacar “Nova transação” como ação primária.
- Agrupar CSV e OFX em uma ação secundária chamada “Importar”.
- Exibir filtros ativos como chips removíveis.
- Adicionar “Limpar filtros” e quantidade de resultados.
- Persistir filtros na URL para permitir retorno e compartilhamento da visão.
- Implementar paginação ou carregamento progressivo pelo backend.
- Oferecer ações em lote em uma barra contextual.

### Critérios de aceite

- Não há rolagem horizontal no fluxo principal em viewport de 360 px.
- Filtros podem ser identificados e removidos individualmente.
- O frontend não precisa carregar todo o histórico para filtrar uma página.

## Fase 3 — Feedback e prevenção de erros

### Entregáveis

- Substituir `window.confirm()` por diálogos consistentes.
- Explicar o impacto de exclusões sobre saldos, faturas e lançamentos relacionados.
- Exigir confirmação reforçada ao excluir conta com movimentações.
- Implementar fila de notificações com sucesso, informação, aviso e erro.
- Exibir erros de formulário próximos aos respectivos campos.
- Incluir ação “Tentar novamente” nos erros de consulta.
- Aplicar atualização otimista somente a operações reversíveis.
- Oferecer “Desfazer” quando tecnicamente seguro.
- Padronizar estados de processamento nos botões.

### Critérios de aceite

- Toda ação destrutiva informa exatamente o que será afetado.
- Toda falha recuperável possui uma ação visível de recuperação.
- Mensagens simultâneas não se sobrepõem nem são perdidas.

## Fase 4 — Estados de tela e primeiro uso

### Entregáveis

- Criar skeletons reutilizáveis para cards, tabelas e gráficos.
- Criar estados vazios com explicação e chamada para ação.
- Adicionar jornada inicial: conta, categorias, orçamento e primeiro lançamento.
- Exibir checklist de configuração inicial no painel.
- Explicar os pilares Kakebo no contexto em que aparecem.
- Não renderizar gráficos vazios sem orientação ao usuário.
- Diferenciar indisponibilidade da API, sessão expirada e ausência de dados.

### Critérios de aceite

- Um usuário novo consegue configurar o sistema sem documentação externa.
- Todas as páginas possuem estados explícitos de carregamento, erro e vazio.

## Fase 5 — Navegação e arquitetura da informação

### Entregáveis

- Validar nomenclaturas do menu com usuários.
- Avaliar “Resumo mensal” para “Reflexão” e “Lançamentos” para “Fluxo de Caixa”.
- Explicar ou renomear “Fluxo Contábil” para diferenciá-lo do fluxo de caixa.
- Adicionar navegação inferior no mobile para os destinos principais.
- Criar atalhos contextuais:
  - conta para extrato filtrado;
  - fatura para seus lançamentos;
  - orçamento para despesas da categoria;
  - indicador do painel para seu detalhamento.
- Preservar mês e contexto ao navegar entre páginas relacionadas.
- Indicar título e localização atual no cabeçalho móvel.

### Critérios de aceite

- Usuários identificam corretamente a finalidade de cada item do menu.
- A navegação entre resumo e detalhe mantém período e filtros relevantes.

## Fase 6 — Acessibilidade e design system

### Entregáveis

- Garantir nomes acessíveis e tooltips em botões representados apenas por ícones.
- Usar áreas de toque com no mínimo 44 × 44 px nas ações essenciais.
- Evitar texto funcional menor que 12 px.
- Revisar contraste, foco visível e estados desabilitados.
- Garantir operação integral por teclado.
- Gerenciar foco na abertura e no fechamento de modais.
- Associar mensagens de erro aos campos com atributos ARIA.
- Respeitar preferência por redução de movimento.
- Padronizar cabeçalhos, seletores de período, confirmações, estados vazios e skeletons.
- Adicionar auditoria automatizada de acessibilidade ao CI.

### Critérios de aceite

- Fluxos críticos podem ser concluídos somente com teclado.
- Nenhum erro crítico nas auditorias automatizadas de acessibilidade.
- Console sem avisos de React ou Radix nos fluxos cobertos.

## Fase 7 — Desempenho e resiliência da PWA

### Entregáveis

- Medir e reduzir bundles grandes, especialmente gráficos e importadores.
- Carregar recursos pesados apenas quando seus fluxos forem abertos.
- Definir política de cache e atualização do service worker.
- Informar quando houver nova versão disponível.
- Exibir estado offline e limitar ações que exigem conexão.
- Evitar que cache antigo mantenha uma interface incompatível com a API.
- Configurar metas de desempenho e monitorá-las no CI.

### Critérios de aceite

- Atualizações deixam de depender de recarga forçada do navegador.
- O usuário sabe quando está offline ou utilizando versão desatualizada.
- Páginas principais permanecem responsivas em dispositivos móveis intermediários.

## Ordem recomendada

1. Linha de base de UX.
2. Lançamentos financeiros orientados.
3. Fluxo de caixa responsivo.
4. Feedback e prevenção de erros.
5. Estados de tela e primeiro uso.
6. Navegação e arquitetura da informação.
7. Acessibilidade e design system.
8. Desempenho e resiliência da PWA.

## Estratégia de entrega

- Dividir cada fase em mudanças pequenas e reversíveis.
- Não misturar alterações financeiras de backend com mudanças puramente visuais sem testes de integração.
- Validar desktop e mobile em cada entrega.
- Executar lint, testes e build no container do frontend.
- Usar feature flags para reformulações extensas quando necessário.
- Atualizar este documento ao concluir cada fase e registrar decisões relevantes.

## Status

- [x] Fase 0 — Linha de base de UX
- [x] Fase 1 — Lançamentos financeiros orientados
- [x] Fase 2 — Fluxo de caixa responsivo
- [x] Fase 3 — Feedback e prevenção de erros
- [x] Fase 4 — Estados de tela e primeiro uso
- [x] Fase 5 — Navegação e arquitetura da informação
- [ ] Fase 6 — Acessibilidade e design system
  - Primeiro bloco concluído; auditoria das telas e formulários restantes em andamento. Consulte `FASE_6_FRONTEND.md`.
- [x] Fase 7 — Desempenho e resiliência da PWA
