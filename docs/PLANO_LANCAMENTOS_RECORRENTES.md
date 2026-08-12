# Plano — gestão de lançamentos recorrentes

## Objetivo

Criar uma tela única para consultar receitas, despesas e transferências recorrentes e permitir a alteração do valor de uma competência específica ou daquela competência em diante, preservando histórico, saldos, faturas e auditoria.

## Status

- [x] Fase 0 — regras financeiras e critérios de aceite
- [x] Fase 1 — consulta e resumo das recorrências
- [x] Fase 2 — simulação e alteração de valor
- [x] Fase 3 — tela responsiva de recorrências
- [x] Fase 4 — modal de alteração e confirmação de impacto
- [x] Fase 5 — histórico e auditoria na interface
- [x] Fase 6 — testes financeiros, acessibilidade e integração
- [x] Fase 7 — entrega e monitoramento

## Fase 0 — regras aprovadas para implementação

### 1. O que constitui uma recorrência

- A série é identificada por `transacao_pai_id` e deve possuir `recorrente = true`.
- Parcelamentos comuns, com `recorrente = false`, não aparecem nesta tela.
- Uma transferência recorrente é uma única série lógica, mesmo contendo uma saída e uma entrada por mês.
- Registros sem `transacao_pai_id` não podem ser agrupados automaticamente nesta primeira versão.
- A quantidade e a numeração existentes (`parcela_atual` e `total_parcelas`) não mudam ao alterar somente o valor.

### 2. Definição de competência

- Contas comuns: mês UTC de `data_transacao`, no formato `YYYY-MM`.
- Cartão com fatura vinculada: `fatura.competencia` é a fonte de verdade.
- Cartão legado sem `fatura_id`: a competência é calculada pelas regras de fechamento do cartão.
- Transferência: competência da data compartilhada pelo grupo; as duas pontas devem permanecer na mesma competência.
- A competência selecionada é inclusiva em alterações com escopo “desta competência em diante”.

### 3. Escopos de alteração

O usuário poderá escolher exatamente um escopo:

1. `SomenteCompetencia`: altera apenas a ocorrência da competência escolhida.
2. `DestaCompetenciaEmDiante`: altera a ocorrência escolhida e todas as posteriores já geradas.

Competências anteriores nunca são alteradas implicitamente. A primeira versão não criará novas competências durante a mudança de valor; a prorrogação da série continuará sendo uma ação separada.

### 4. Proteção do histórico financeiro

- Lançamento comum com status `Pago`: bloqueado para alteração em lote.
- Fatura com status `Paga`: bloqueada.
- Fatura parcialmente paga: bloqueada, pois já possui liquidação vinculada.
- Fatura fechada ou vencida, ainda sem pagamento: pode ser alterada somente após simulação e confirmação reforçada.
- Fatura aberta e lançamento pendente: podem ser alterados normalmente.
- Se qualquer ocorrência afetada estiver bloqueada, a operação inteira é recusada; não haverá atualização parcial silenciosa.
- A interface deve oferecer um link para o lançamento individual quando o ajuste em lote estiver bloqueado.

### 5. Regras por tipo

#### Receita e despesa

- O valor deve ser positivo, com no máximo duas casas decimais.
- O tipo, a conta, a categoria, a descrição e a data não mudam nesta operação.
- Lançamentos pendentes em conta comum não alteram `saldo_atual`.
- Alterações permitidas que tenham impacto em saldo devem usar o cálculo financeiro centralizado em centavos.

#### Transferência

- Saída e entrada da mesma competência devem receber exatamente o mesmo valor.
- A atualização deve localizar as pontas pelo grupo de transferência, não pela descrição.
- A operação é atômica: ou as duas contas são atualizadas, ou nenhuma é.
- Se uma das pontas estiver ausente ou incompatível, a competência aparece como inconsistente e fica bloqueada.

#### Cartão de crédito

- Toda ocorrência vinculada conserva seu `fatura_id`.
- Após uma alteração, o total e o status de cada fatura afetada devem ser recalculados pelos lançamentos vinculados.
- Parcelas legadas sem `fatura_id` continuam suportadas pela competência calculada, sem backfill automático durante uma leitura.
- A operação não muda fechamento, vencimento nem pagamentos existentes.

### 6. Simulação obrigatória

Antes da confirmação, o backend deve devolver uma prévia contendo:

- valor atual e novo valor;
- competência inicial e escopo;
- quantidade de ocorrências e séries financeiras afetadas;
- contas e faturas afetadas;
- diferença total projetada;
- competências bloqueadas e seus motivos;
- indicação de fatura fechada que exige confirmação reforçada.

A execução deverá receber um identificador ou versão da simulação. Se os dados mudarem entre simulação e confirmação, o backend rejeita a execução e solicita uma nova prévia.

### 7. Atomicidade, concorrência e auditoria

- Toda alteração ocorre dentro de uma única transação Prisma.
- A propriedade da série e de todas as contas deve ser validada pelo `usuario_id` autenticado.
- O backend deve reler e validar as ocorrências no momento da confirmação.
- Valores são calculados em centavos/`Decimal`; não usar ponto flutuante para diferenças financeiras.
- A auditoria registra série, competência inicial, escopo, valor anterior, novo valor, IDs afetados e faturas recalculadas.
- A resposta inclui `requestId` para investigação operacional.

### 8. Estado da recorrência

O estado será derivado, sem coluna nova nesta primeira versão:

- `Ativa`: possui ao menos uma ocorrência não bloqueada na competência atual ou futura.
- `Encerrada`: não possui ocorrências futuras.
- `Inconsistente`: possui transferência incompleta ou dados que impedem o agrupamento seguro.

Recorrências encerradas permanecem consultáveis e podem ser filtradas.

### 9. Critérios de aceite da Fase 0

- Competência possui uma regra inequívoca para todos os tipos de conta.
- Alterações passadas liquidadas não podem ocorrer em lote.
- Transferências são tratadas como uma série única e atômica.
- Faturas abertas, fechadas, parciais e pagas possuem comportamento definido.
- A operação possui simulação, proteção contra concorrência e auditoria.
- Nenhuma migration é necessária para iniciar as fases 1 e 2.

## Contratos previstos

```http
GET /api/recorrencias
GET /api/recorrencias/:id
POST /api/recorrencias/:id/simular-alteracao
PATCH /api/recorrencias/:id/valor
```

## Fase 1 — resultado implementado

- `GET /api/recorrencias` disponível com paginação e filtros por busca, tipo, conta e situação.
- `GET /api/recorrencias/:id` disponível com resumo e ocorrências da série.
- Receitas, despesas e transferências são agrupadas por `transacao_pai_id`.
- As duas pontas de transferências são apresentadas como uma única recorrência.
- Séries de transferência incompletas são marcadas como `Inconsistente`.
- Competências de cartão usam a fatura vinculada e possuem fallback para cartões legados.
- A consulta valida o `usuario_id` e não expõe séries de outros usuários.
- Teste de integração cobre cartão recorrente, paginação, busca, detalhe, 404 e transferência filtrada pela conta de destino.

## Fase 2 — resultado implementado

- `POST /api/recorrencias/:id/simular-alteracao` calcula impacto sem modificar dados.
- `PATCH /api/recorrencias/:id/valor` confirma a alteração usando o identificador da simulação.
- O identificador considera valores, status, faturas e pagamentos; qualquer mudança concorrente invalida a prévia.
- Os escopos `SomenteCompetencia` e `DestaCompetenciaEmDiante` estão disponíveis.
- Lançamentos pagos e faturas pagas ou parcialmente pagas são bloqueados.
- Faturas fechadas ou vencidas exigem confirmação explícita.
- Transferências atualizam saída e entrada atomicamente.
- Saldos são ajustados pela diferença calculada em centavos quando houver impacto financeiro.
- Faturas afetadas têm total e status recalculados dentro da mesma transação.
- A operação usa isolamento serializável e registra auditoria financeira.
- A integração no PostgreSQL cobre conflito de simulação, confirmação de fatura fechada, cartão com várias competências e transferência com duas pontas.

## Fase 3 — resultado implementado

- Nova rota protegida `/recorrencias`, carregada sob demanda.
- Item “Recorrências” disponível na navegação desktop e no menu mobile.
- Serviço frontend tipado para listagem e detalhe das séries.
- Filtros por descrição, tipo, conta e situação persistidos na URL.
- Paginação, limpeza de filtros e contagem total implementadas.
- Tabela responsiva no desktop e cartões próprios no mobile.
- Identificação visual de receita, despesa, transferência e situação da série.
- Detalhe expansível com histórico, projeções, competência, valor, status e vínculo com fatura.
- Transferências exibem uma ocorrência lógica por competência, sem duplicar entrada e saída.
- Estados de carregamento, atualização, erro e lista vazia implementados.
- Lint e testes do frontend aprovados; build PWA e orçamento de bundle aprovados no Docker.

## Fase 4 — resultado implementado

- Ação “Ajustar valor” disponível na tabela desktop e nos cartões mobile.
- Séries inconsistentes mantêm a ação bloqueada com orientação contextual.
- Modal permite informar novo valor, competência inicial e escopo da alteração.
- Fluxo em duas etapas: configuração e revisão obrigatória da simulação.
- Revisão apresenta valor atual, novo valor, diferença total, competências e faturas afetadas.
- Competências protegidas são exibidas com o motivo e impedem a confirmação.
- Faturas fechadas ou vencidas exigem marcação explícita antes de salvar.
- Conflitos de simulação retornam o usuário à etapa de prévia para evitar confirmação desatualizada.
- Após sucesso, recorrências, detalhes, contas, transações, faturas e fluxo contábil são atualizados.
- Testes de componente cobrem simulação antes da execução e bloqueio de competência protegida.
- Lint, build PWA e orçamento de bundle aprovados no Docker.

## Fase 5 — resultado implementado

- O detalhe da recorrência apresenta uma linha do tempo de criação e mudanças de valor.
- Novas alterações registram valores anteriores por transação e competência, novo valor, escopo e faturas afetadas.
- Eventos exibem data, hora e `requestId` para correlação operacional.
- Eventos antigos sem todos os metadados continuam sendo apresentados com indicação de informação indisponível.
- O histórico respeita o usuário autenticado e está limitado aos 50 eventos mais recentes da série.

## Fase 6 — resultado implementado

- Integração PostgreSQL cobre listagem, detalhe, alteração pontual e futura, cartão, transferência, conflito e auditoria.
- Teste adicional garante o bloqueio de uma série que contenha lançamento já pago.
- Testes de componente cobrem revisão obrigatória e impedimento visual de confirmação protegida.
- A rota `/recorrencias` foi incluída na barreira Axe existente.
- Auditorias isoladas em desktop e mobile concluídas sem violações críticas ou graves.
- O limite geral permanece em 100 requisições por 15 minutos nos ambientes normais; apenas o ambiente de testes usa 300 para permitir as jornadas completas no mesmo IP do runner.

## Fase 7 — entrega e monitoramento

- Backend e frontend compilam sem erros.
- Build PWA concluído no Docker.
- Orçamentos de bundle aprovados; o chunk de recorrências possui 24,96 kB (6,96 kB gzip).
- A funcionalidade não exige migration nem alteração no schema do Prisma.
- O pipeline existente executa testes backend, frontend, E2E e sincronização do Neon antes do deploy.
- A operação e os sinais recomendados de monitoramento foram adicionados ao manual operacional.
- Entrega pronta para commit e execução do pipeline; nenhum deploy externo foi realizado nesta etapa.

Payload inicial da alteração:

```json
{
  "novo_valor": 7.90,
  "competencia_inicial": "2026-10",
  "escopo": "DestaCompetenciaEmDiante",
  "simulacao_id": "token-da-simulacao",
  "confirmar_faturas_fechadas": false
}
```

## Encerramento

As fases 0 a 7 estão concluídas. Após o deploy, acompanhar respostas `409` na confirmação, erros 5xx nos endpoints de recorrência e divergências na auditoria diária de saldos.

## Complemento — prorrogação e encerramento

- A tela reúne “Ajustar valor”, “Prorrogar”, “Encerrar” e “Histórico” em um menu de opções no desktop e no mobile.
- O histórico é aberto em modal, sem deslocar o conteúdo nem criar um painel no fim da tela.
- A prorrogação informa o novo fim previsto e cria as competências como pendentes.
- Transferências prorrogadas preservam as duas pontas e o grupo de cada competência.
- Lançamentos prorrogados de cartão são vinculados às faturas corretas.
- O encerramento exige escolher a última competência mantida e informa quantas serão removidas.
- Competências pagas e faturas com pagamento são protegidas contra remoção.
- Faturas afetadas são recalculadas atomicamente e as duas operações ficam registradas na auditoria.
- A integração PostgreSQL no Docker cobre prorrogação e encerramento de cartão e transferência.
