# Linha de base de qualidade e testes

## Ambientes

- Desenvolvimento: PostgreSQL do Docker Compose (`kakebo`).
- Integração/CI: PostgreSQL descartável chamado obrigatoriamente `kakebo_test`.
- O teste de integração só executa com `RUN_DB_TESTS=true` e interrompe se a URL não contiver `kakebo_test`.

## Fluxos financeiros cobertos

| Fluxo | Resultado esperado | Cobertura |
|---|---|---|
| Receita paga em conta comum | Incrementa o saldo uma única vez | testes de domínio/serviço |
| Despesa paga em conta comum | Decrementa o saldo uma única vez | integração API + PostgreSQL |
| Parcelamento | Soma das parcelas preserva todos os centavos | teste financeiro |
| Recorrência nos dias 29–31 | Datas são ajustadas sem avançar para mês incorreto | teste financeiro |
| Compra no cartão | É vinculada à competência determinada pelo fechamento | teste do ciclo de fatura |
| Fatura aberta/fechada | Usa ciclos distintos na virada do fechamento | teste do ciclo de fatura |
| Pagamento parcial/total | Atualiza status e saldo restante | teste de status de fatura |
| Estorno de pagamento | Retorna a fatura ao estado parcial/pendente | teste de status de fatura |
| Transferência | As duas pontas compartilham grupo e direções opostas | serviço + modelo Prisma |
| Autenticação | Sessão fica em cookie HttpOnly; escrita exige CSRF | teste CSRF + integração API |
| Isolamento de usuário | Recursos de outro usuário não são aceitos | teste de segurança |

## Pipeline obrigatório

O CI executa, em Node 20:

1. `npm ci`;
2. `npx prisma validate`;
3. criação do schema em PostgreSQL descartável com `prisma db push`;
4. lint e build do backend;
5. testes unitários e de integração com Supertest;
6. lint, build e testes do frontend.

## Execução local

```bash
npm run lint
npm run build
npm test

cd frontend
npm run lint
npm run build
npm test
```

Para a integração, forneça uma `DATABASE_URL` exclusiva cujo banco se chame `kakebo_test`:

```bash
RUN_DB_TESTS=true npm run test:integration
```

Nunca aponte esse comando para o banco de desenvolvimento ou produção.
