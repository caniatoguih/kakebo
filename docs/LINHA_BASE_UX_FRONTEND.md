# Linha de base de UX do frontend

Data da medição: 8 de agosto de 2026.

## Escopo

Esta linha de base registra a situação do frontend antes da execução das melhorias de usabilidade. Ela cobre estrutura, jornadas críticas, comportamento responsivo, acessibilidade, testes e tamanho inicial dos principais bundles.

## Inventário de telas

| Área | Rota | Ação principal | Estados relevantes |
| --- | --- | --- | --- |
| Login | `/login` | Entrar | validação, autenticação inválida, carregamento |
| Cadastro | `/cadastro` | Criar conta de usuário | validação, e-mail existente, sucesso |
| Reflexão | `/dashboard` | Consultar desempenho mensal | carregando, erro, mês sem dados, gráficos |
| Fluxo de caixa | `/transacoes` | Registrar lançamento | filtros, vazio, seleção em lote, importação |
| Orçamento | `/planejamento` | Criar orçamento | mês vazio, pilares, edição e exclusão |
| Fluxo contábil | `/fluxo-contabil` | Consultar e imprimir relatório | filtros, carregamento, erro, impressão |
| Contas e cartões | `/contas` | Criar conta | vazio, cartão, fatura aberta/fechada, pagamento |
| Categorias | `/categorias` | Criar subcategoria | despesas, receitas, vazio e exclusão |

## Inventário de modais e operações críticas

- Nova conta e edição de conta.
- Novo lançamento e edição de lançamento.
- Transferência entre contas.
- Importação CSV.
- Sincronização OFX e conciliação.
- Histórico mensal e operações de fatura.
- Pagamento de fatura fechada.
- Novo orçamento, edição e desenho automático.
- Nova subcategoria.

## Jornadas críticas

### Primeiro acesso

1. Criar usuário.
2. Entrar no sistema.
3. Cadastrar a primeira conta.
4. Conferir saldo inicial.
5. Criar categorias ou utilizar as existentes.
6. Registrar o primeiro lançamento.
7. Consultar o reflexo no painel.

### Registrar despesa ou receita

1. Abrir Fluxo de Caixa.
2. Abrir Nova Transação.
3. Informar descrição, valor e data.
4. Selecionar tipo, status, conta e categoria.
5. Configurar repetição quando aplicável.
6. Salvar e conferir o lançamento e o saldo.

### Registrar transferência

1. Abrir Nova Transação.
2. Selecionar Transferência.
3. Informar descrição, valor e data.
4. Selecionar conta de origem e conta de destino distintas.
5. Salvar.
6. Conferir saída, entrada e os dois saldos.

### Pagar fatura

1. Abrir Contas e Cartões.
2. Identificar a última fatura fechada.
3. Abrir Pagar Fatura.
4. Selecionar conta pagadora, valor e data.
5. Confirmar e conferir saldo restante e lançamentos relacionados.

### Importar movimentações

1. Abrir Fluxo de Caixa.
2. Selecionar CSV ou OFX.
3. Escolher conta e arquivo.
4. Mapear ou conciliar os dados.
5. Revisar operações detectadas.
6. Confirmar e conferir o resultado.

## Evidência visual

- [Dashboard — desktop](ux-baseline/desktop-chromium-dashboard.png)
- [Fluxo de caixa — desktop](ux-baseline/desktop-chromium-fluxo-de-caixa.png)
- [Dashboard — mobile](ux-baseline/mobile-chromium-dashboard.png)
- [Fluxo de caixa — mobile](ux-baseline/mobile-chromium-fluxo-de-caixa.png)

As capturas são regeneradas pela suíte Playwright nos projetos `desktop-chromium` e `mobile-chromium`.

## Problemas observados

### Alta prioridade

- A tabela do fluxo de caixa ultrapassa a largura da tela no mobile.
- As três ações do cabeçalho não cabem na viewport; “Nova Transação” fica parcialmente cortada.
- Há botões sem nome acessível, classificados como violação crítica pelo axe.
- Algumas combinações de texto e fundo não atingem contraste suficiente.

### Média prioridade

- A hierarquia de títulos no mobile possui salto de nível.
- Estados de carregamento e erro usam texto simples, sem skeleton ou recuperação direta.
- Exclusões dependem de diálogos nativos do navegador.
- Filtros são processados no cliente depois do carregamento de até mil itens.
- A experiência inicial não orienta a sequência conta, categoria, orçamento e lançamento.

### Baixa prioridade

- Textos funcionais de 10 px reduzem legibilidade.
- Não há política visível para atualização da PWA ou versão desatualizada.
- Componentes semelhantes não compartilham estados vazios e cabeçalhos padronizados.

## Linha de base de acessibilidade

Auditoria automatizada do dashboard com axe:

| Projeto | Violações | Resultado |
| --- | ---: | --- |
| Desktop Chromium | 2 | `button-name` crítica; `color-contrast` séria |
| Mobile Chromium | 3 | `button-name` crítica; `color-contrast` séria; `heading-order` moderada |

Esta medição é informativa nesta fase. As violações devem ser eliminadas progressivamente e se tornar bloqueantes no CI durante a Fase 6.

## Linha de base de testes

- Teste de componente do sistema de feedback.
- Teste de componente para criação de despesa.
- Teste de componente para transferência com origem e destino distintos.
- Jornada E2E de cadastro, login, dashboard e fluxo de caixa.
- E2E executado em desktop Chromium e viewport Pixel 5.
- Capturas, traces de falha e relatório de acessibilidade disponíveis como artefatos do CI.

## Linha de base de bundles

Valores do build de produção antes das fases de otimização:

| Recurso | Tamanho | Gzip |
| --- | ---: | ---: |
| Entrada principal | 345,89 kB | 112,23 kB |
| Dashboard | 362,80 kB | 106,45 kB |
| Transações | 70,36 kB | 16,31 kB |
| Serviço de transações e importação | 50,53 kB | 17,73 kB |
| Fluxo contábil | 26,40 kB | 5,71 kB |
| CSS principal | 58,88 kB | 10,47 kB |

O Dashboard e a entrada principal são os primeiros candidatos a análise na fase de desempenho.

## Automação

- `npm test`: testes de componentes.
- `npm run test:e2e`: jornadas desktop e mobile.
- `npm run build`: compilação e relatório dos chunks.
- O workflow de CI possui jobs separados para frontend unitário e frontend E2E.

## Próximos passos

1. Executar a Fase 1 do plano de usabilidade.
2. Usar esta linha de base para comparar responsividade e acessibilidade.
3. Atualizar as métricas após cada fase sem apagar os resultados históricos.
