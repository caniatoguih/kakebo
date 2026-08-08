# Operação, observabilidade e recuperação

## Correlação e logs

Toda resposta inclui `X-Request-Id`. Um identificador válido enviado pelo cliente é preservado; valores inválidos são substituídos por UUID. Use esse ID para correlacionar resposta, log HTTP e evento financeiro.

Os logs são JSON em produção e possuem redação para `Authorization`, cookies, `Set-Cookie`, senha, hash e token. Não adicione corpos completos de requisições nem dados bancários aos logs.

## Métricas

`GET /api/metrics` entrega métricas no formato Prometheus:

- tempo ativo do processo;
- requisições totais e ativas;
- erros HTTP 5xx;
- soma da duração das requisições.

Em produção, `METRICS_TOKEN` é obrigatório. O coletor deve enviar `X-Metrics-Token` ou `Authorization: Bearer <token>`. Recomenda-se coletar a cada 30 segundos e alertar para indisponibilidade, aumento de 5xx e latência média crescente.

## Auditoria financeira

Criação, edição, exclusão, importação, alteração de status, transferências e pagamentos de fatura registram eventos na mesma transação PostgreSQL da operação. A auditoria contém IDs e metadados mínimos, nunca credenciais ou cookies.

O usuário autenticado pode consultar seus próprios eventos em:

```text
GET /api/auditoria?limit=50&cursor=<id-opcional>
```

## Auditoria de saldos

O comando abaixo é somente leitura e retorna código `1` quando encontra divergências:

```bash
docker compose exec -T app npx tsx src/scripts/auditBalances.ts
```

Ele deve ser executado diariamente. Uma divergência deve gerar incidente e investigação; não corrija automaticamente antes de identificar a operação causadora.

## Backup

```bash
npm run backup
```

O backup custom-format e seu SHA-256 são gravados em `backups/`, que não é versionado. Copie os arquivos para armazenamento externo criptografado. Política sugerida: 7 diários, 4 semanais e 12 mensais.

Exemplo de agendamento diário às 03:15:

```cron
15 3 * * * cd /caminho/kakebo && /usr/bin/npm run backup >> /var/log/kakebo-backup.log 2>&1
```

## Restauração

A restauração é destrutiva e exige confirmação explícita. Ela valida a listagem do dump e, quando o destino é `kakebo`, para o backend durante a operação.

```bash
scripts/restore-database.sh backups/kakebo-AAAAMMDDTHHMMSSZ.dump --confirm
```

Após restaurar:

1. execute `npx prisma migrate status` no contêiner do backend;
2. execute a auditoria de saldos;
3. valide `/api/health`;
4. confirme login, listagem de contas e uma fatura conhecida.

Faça um ensaio de restauração em banco temporário pelo menos uma vez por mês. Um backup sem restauração testada não deve ser considerado recuperável.
