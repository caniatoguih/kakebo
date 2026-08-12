import type { Response } from 'supertest';
import request from 'supertest';
import prisma from '../src/lib/prisma';

const runDatabaseTests = process.env.RUN_DB_TESTS === 'true';
const describeDatabase = runDatabaseTests ? describe : describe.skip;
const email = 'integration-test@kakebo.local';

function csrfFrom(response: Response): string {
  const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
  const csrfCookie = cookies?.find((cookie) => cookie.startsWith('kakebo_csrf='));
  if (!csrfCookie) throw new Error('Cookie CSRF não retornado pelo login.');
  return decodeURIComponent(csrfCookie.split(';')[0].split('=')[1]);
}

describeDatabase('API com PostgreSQL isolado', () => {
  let app: typeof import('../src/app').default;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('kakebo_test')) {
      throw new Error('Os testes de integração só podem usar um banco chamado kakebo_test.');
    }
    process.env.JWT_SECRET ||= 'integration-test-secret-with-at-least-32-characters';
    app = (await import('../src/app')).default;
    await prisma.usuario.deleteMany({ where: { email } });
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('autentica por cookie, protege escrita e persiste um fluxo financeiro', async () => {
    await request(app).post('/api/auth/register').send({
      nome: 'Integration Test', email, senha: 'Integration!2026',
    }).expect(201);

    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ email, senha: 'Integration!2026' }).expect(200);
    expect(login.body).not.toHaveProperty('token');
    expect(login.headers['set-cookie']?.join(';')).toContain('HttpOnly');
    const csrf = csrfFrom(login);

    await agent.get('/api/auth/me').set('X-Request-Id', 'integration-request-1').expect('X-Request-Id', 'integration-request-1')
      .expect(200).expect(({ body }) => expect(body.email).toBe(email));
    await agent.post('/api/contas').send({ nome: 'Conta teste', tipo: 'Corrente', saldo_inicial: 100 }).expect(403);

    const account = await agent.post('/api/contas').set('X-CSRF-Token', csrf).send({
      nome: 'Conta teste', tipo: 'Corrente', saldo_inicial: 100,
    }).expect(201);
    await agent.post('/api/transacoes').set('X-CSRF-Token', csrf).send({
      conta_id: account.body.id,
      descricao: 'Compra integração',
      valor: 25.5,
      tipo: 'Despesa',
      data_transacao: '2026-08-07T12:00:00.000Z',
      status: 'Pago',
      total_parcelas: 1,
    }).expect(201);

    const accounts = await agent.get('/api/contas').expect(200);
    expect(Number(accounts.body[0].saldo_atual)).toBe(74.5);
    const transactions = await agent.get('/api/transacoes?mes=8&ano=2026&page=1&limit=10').expect(200);
    expect(transactions.body).toMatchObject({ total: 1 });
    expect(transactions.body.transacoes[0].descricao).toBe('Compra integração');
    expect(await prisma.auditoriaFinanceira.count({ where: { usuario_id: account.body.usuario_id } })).toBeGreaterThan(0);
    const audit = await agent.get('/api/auditoria?limit=10').expect(200);
    expect(audit.body.eventos[0]).toMatchObject({ acao: 'CRIAR', entidade: 'Transacao' });
    expect(audit.body.eventos[0].request_id).toBeTruthy();

    const reflection = await agent.get('/api/relatorios/kakebo-reflexao?mes=8&ano=2026').expect(200);
    expect(reflection.body.resumo).toMatchObject({
      receitas_realizadas: 0,
      despesas_realizadas: 25.5,
      resultado_real: -25.5,
      despesas_sem_categoria: 25.5,
    });
    expect(reflection.body.historico).toHaveLength(6);
    expect(reflection.body).toEqual(expect.objectContaining({
      comparacao_mes_anterior: expect.any(Object),
      projecao: expect.any(Object),
      saude: expect.any(Object),
      desvios: expect.any(Array),
      insights: expect.any(Array),
    }));

    const card = await agent.post('/api/contas').set('X-CSRF-Token', csrf).send({
      nome: 'Cartão recorrência', tipo: 'CartaoCredito', saldo_inicial: 0,
      limite_total: 5000, dia_fechamento: 10, dia_vencimento: 17,
    }).expect(201);
    const recurringCardTransaction = await agent.post('/api/transacoes').set('X-CSRF-Token', csrf).send({
      conta_id: card.body.id,
      descricao: 'Academia recorrente',
      valor: 154.64,
      tipo: 'Despesa',
      data_transacao: '2026-09-10T03:00:00.000Z',
      status: 'Pendente',
      total_parcelas: 16,
      recorrente: true,
    }).expect(201);
    expect(await prisma.transacao.count({
      where: { usuario_id: account.body.usuario_id, conta_id: card.body.id, recorrente: true },
    })).toBe(16);
    expect(await prisma.faturaCartao.count({ where: { cartao_id: card.body.id } })).toBe(16);

    const recurringList = await agent.get('/api/recorrencias?tipo=Despesa&busca=academia&page=1&limit=10').expect(200);
    expect(recurringList.body).toMatchObject({ total: 1, page: 1, limit: 10, total_pages: 1 });
    expect(recurringList.body.recorrencias[0]).toMatchObject({
      id: recurringCardTransaction.body.transacao_pai_id,
      descricao: 'Academia recorrente',
      tipo: 'Despesa',
      ocorrencias_geradas: 16,
      valor_atual: 154.64,
    });
    const recurringDetail = await agent
      .get(`/api/recorrencias/${recurringCardTransaction.body.transacao_pai_id}`)
      .expect(200);
    expect(recurringDetail.body.ocorrencias).toHaveLength(16);
    expect(recurringDetail.body.ocorrencias[0]).toMatchObject({ competencia: '2026-10', valor: 154.64 });
    await agent.get('/api/recorrencias/00000000-0000-4000-8000-000000000000').expect(404);

    await prisma.faturaCartao.update({
      where: { id: recurringDetail.body.ocorrencias[0].fatura_id },
      data: { status: 'Fechada' },
    });
    const closedInvoiceChange = {
      novo_valor: 180,
      competencia_inicial: '2026-10',
      escopo: 'SomenteCompetencia',
    };
    const closedInvoiceSimulation = await agent
      .post(`/api/recorrencias/${recurringCardTransaction.body.transacao_pai_id}/simular-alteracao`)
      .set('X-CSRF-Token', csrf)
      .send(closedInvoiceChange)
      .expect(200);
    expect(closedInvoiceSimulation.body).toMatchObject({
      pode_executar: true,
      requer_confirmacao_fatura_fechada: true,
      ocorrencias_afetadas: 1,
    });
    await agent.patch(`/api/recorrencias/${recurringCardTransaction.body.transacao_pai_id}/valor`)
      .set('X-CSRF-Token', csrf)
      .send({
        ...closedInvoiceChange,
        simulacao_id: closedInvoiceSimulation.body.simulacao_id,
        confirmar_faturas_fechadas: false,
      })
      .expect(409);
    await agent.patch(`/api/recorrencias/${recurringCardTransaction.body.transacao_pai_id}/valor`)
      .set('X-CSRF-Token', csrf)
      .send({
        ...closedInvoiceChange,
        simulacao_id: closedInvoiceSimulation.body.simulacao_id,
        confirmar_faturas_fechadas: true,
      })
      .expect(200);

    const cardChangeInput = {
      novo_valor: 200,
      competencia_inicial: '2027-01',
      escopo: 'DestaCompetenciaEmDiante',
    };
    const cardSimulation = await agent
      .post(`/api/recorrencias/${recurringCardTransaction.body.transacao_pai_id}/simular-alteracao`)
      .set('X-CSRF-Token', csrf)
      .send(cardChangeInput)
      .expect(200);
    expect(cardSimulation.body).toMatchObject({
      pode_executar: true,
      ocorrencias_afetadas: 13,
      lancamentos_afetados: 13,
      diferenca_total: 589.68,
      requer_confirmacao_fatura_fechada: false,
    });
    await agent.patch(`/api/recorrencias/${recurringCardTransaction.body.transacao_pai_id}/valor`)
      .set('X-CSRF-Token', csrf)
      .send({ ...cardChangeInput, simulacao_id: '0'.repeat(64), confirmar_faturas_fechadas: false })
      .expect(409);
    await agent.patch(`/api/recorrencias/${recurringCardTransaction.body.transacao_pai_id}/valor`)
      .set('X-CSRF-Token', csrf)
      .send({ ...cardChangeInput, simulacao_id: cardSimulation.body.simulacao_id, confirmar_faturas_fechadas: false })
      .expect(200);
    const changedCardOccurrences = await prisma.transacao.findMany({
      where: { transacao_pai_id: recurringCardTransaction.body.transacao_pai_id },
      orderBy: { data_transacao: 'asc' },
    });
    expect(Number(changedCardOccurrences[2].valor)).toBe(154.64);
    expect(Number(changedCardOccurrences[3].valor)).toBe(200);
    const changedCardDetail = await agent
      .get(`/api/recorrencias/${recurringCardTransaction.body.transacao_pai_id}`)
      .expect(200);
    const cardAuditEvent = changedCardDetail.body.historico.find(
      (event: { acao: string }) => event.acao === 'ALTERAR_VALOR_RECORRENCIA',
    );
    expect(cardAuditEvent.dados).toMatchObject({
      competencia_inicial: '2027-01',
      escopo: 'DestaCompetenciaEmDiante',
      novo_valor: 200,
    });
    expect(cardAuditEvent.dados.valores_anteriores).toHaveLength(13);

    await agent.post('/api/transacoes/prorrogar').set('X-CSRF-Token', csrf).send({
      transacao_pai_id: recurringCardTransaction.body.transacao_pai_id, novos_meses: 2,
    }).expect(200);
    const extendedCardOccurrences = await prisma.transacao.findMany({
      where: { transacao_pai_id: recurringCardTransaction.body.transacao_pai_id },
      orderBy: { parcela_atual: 'asc' },
    });
    expect(extendedCardOccurrences).toHaveLength(18);
    expect(extendedCardOccurrences.slice(-2).every((item) => item.fatura_id && item.total_parcelas === 18)).toBe(true);
    await agent.post('/api/transacoes/cancelar-recorrencia').set('X-CSRF-Token', csrf).send({
      transacao_pai_id: recurringCardTransaction.body.transacao_pai_id, parcela_limite: 16,
    }).expect(200);
    expect(await prisma.transacao.count({
      where: { transacao_pai_id: recurringCardTransaction.body.transacao_pai_id },
    })).toBe(16);

    // Reproduz parcelas de cartao criadas antes da tabela de faturas: elas nao
    // possuem fatura_id, mas devem continuar visiveis ao lado das faturas novas.
    const legacyParentId = 'legacy-installments-integration';
    await prisma.transacao.createMany({
      data: [1, 2, 3].map((installment) => ({
        usuario_id: account.body.usuario_id,
        conta_id: card.body.id,
        descricao: 'Compra parcelada legada',
        valor: 40,
        tipo: 'Despesa',
        data_transacao: new Date(Date.UTC(2028, installment - 1, 5, 12)),
        status: 'Pendente',
        parcela_atual: installment,
        total_parcelas: 3,
        transacao_pai_id: legacyParentId,
        fatura_id: null,
      })),
    });
    const cardInvoices = await agent.get(`/api/contas/${card.body.id}/faturas`).expect(200);
    const visibleLegacyInstallments = cardInvoices.body.faturas
      .flatMap((invoice: { transacoes: Array<{ transacao_pai_id?: string }> }) => invoice.transacoes)
      .filter((transaction: { transacao_pai_id?: string }) => transaction.transacao_pai_id === legacyParentId);
    expect(visibleLegacyInstallments).toHaveLength(3);
    expect(cardInvoices.body.faturas.find((invoice: { mes: string }) => invoice.mes === '2028-01')).toMatchObject({
      total: 240,
    });

    const destination = await agent.post('/api/contas').set('X-CSRF-Token', csrf).send({
      nome: 'Conta destino', tipo: 'Poupanca', saldo_inicial: 0,
    }).expect(201);
    await agent.post('/api/transacoes').set('X-CSRF-Token', csrf).send({
      conta_id: account.body.id,
      conta_destino_id: destination.body.id,
      descricao: 'Transferência integração',
      valor: 40,
      tipo: 'Transferencia',
      data_transacao: '2026-08-07T12:00:00.000Z',
      status: 'Pago',
      total_parcelas: 1,
    }).expect(201);

    const balances = await agent.get('/api/contas').expect(200);
    const sourceBalance = balances.body.find((item: { id: string }) => item.id === account.body.id);
    const destinationBalance = balances.body.find((item: { id: string }) => item.id === destination.body.id);
    expect(Number(sourceBalance.saldo_atual)).toBe(34.5);
    expect(Number(destinationBalance.saldo_atual)).toBe(40);
    expect(await prisma.transacao.count({
      where: { usuario_id: account.body.usuario_id, tipo: 'Transferencia' },
    })).toBe(2);
    expect(await prisma.transferenciaGrupo.count({ where: { usuario_id: account.body.usuario_id } })).toBe(1);

    const transferSide = await prisma.transacao.findFirstOrThrow({
      where: { usuario_id: account.body.usuario_id, tipo: 'Transferencia', transferencia_direcao: 'Saida' },
    });
    await agent.put(`/api/transacoes/${transferSide.id}`).set('X-CSRF-Token', csrf).send({
      conta_id: account.body.id,
      conta_destino_id: destination.body.id,
      subcategoria_id: null,
      descricao: 'Transferência integração editada',
      valor: 30,
      tipo: 'Transferencia',
      data_transacao: '2026-08-07T12:00:00.000Z',
      status: 'Pago',
    }).expect(200);
    const balancesAfterEdit = await agent.get('/api/contas').expect(200);
    expect(Number(balancesAfterEdit.body.find((item: { id: string }) => item.id === account.body.id).saldo_atual)).toBe(44.5);
    expect(Number(balancesAfterEdit.body.find((item: { id: string }) => item.id === destination.body.id).saldo_atual)).toBe(30);

    await agent.delete(`/api/transacoes/${transferSide.id}`).set('X-CSRF-Token', csrf).expect(200);
    expect(await prisma.transacao.count({
      where: { usuario_id: account.body.usuario_id, tipo: 'Transferencia' },
    })).toBe(0);
    const balancesAfterDelete = await agent.get('/api/contas').expect(200);
    expect(Number(balancesAfterDelete.body.find((item: { id: string }) => item.id === account.body.id).saldo_atual)).toBe(74.5);
    expect(Number(balancesAfterDelete.body.find((item: { id: string }) => item.id === destination.body.id).saldo_atual)).toBe(0);

    const recurringTransfer = await agent.post('/api/transacoes').set('X-CSRF-Token', csrf).send({
      conta_id: account.body.id,
      conta_destino_id: destination.body.id,
      descricao: 'Reserva recorrente',
      valor: 50,
      tipo: 'Transferencia',
      data_transacao: '2026-09-05T12:00:00.000Z',
      status: 'Pendente',
      total_parcelas: 3,
      recorrente: true,
    }).expect(201);
    const transferRecurrences = await agent
      .get(`/api/recorrencias?tipo=Transferencia&conta_id=${destination.body.id}`)
      .expect(200);
    expect(transferRecurrences.body).toMatchObject({ total: 1 });
    expect(transferRecurrences.body.recorrencias[0]).toMatchObject({
      id: recurringTransfer.body.transacao_pai_id,
      descricao: 'Reserva recorrente',
      tipo: 'Transferencia',
      ocorrencias_geradas: 3,
      situacao: 'Ativa',
      conta_origem: { id: account.body.id },
      conta_destino: { id: destination.body.id },
    });
    const transferChangeInput = {
      novo_valor: 75,
      competencia_inicial: '2026-09',
      escopo: 'SomenteCompetencia',
    };
    const transferSimulation = await agent
      .post(`/api/recorrencias/${recurringTransfer.body.transacao_pai_id}/simular-alteracao`)
      .set('X-CSRF-Token', csrf)
      .send(transferChangeInput)
      .expect(200);
    expect(transferSimulation.body).toMatchObject({
      pode_executar: true, ocorrencias_afetadas: 1, lancamentos_afetados: 2, diferenca_total: 25,
    });
    await agent.patch(`/api/recorrencias/${recurringTransfer.body.transacao_pai_id}/valor`)
      .set('X-CSRF-Token', csrf)
      .send({ ...transferChangeInput, simulacao_id: transferSimulation.body.simulacao_id, confirmar_faturas_fechadas: false })
      .expect(200);
    const changedTransferSides = await prisma.transacao.findMany({
      where: { transacao_pai_id: recurringTransfer.body.transacao_pai_id, parcela_atual: 1 },
    });
    expect(changedTransferSides).toHaveLength(2);
    expect(changedTransferSides.every((transaction) => Number(transaction.valor) === 75)).toBe(true);

    await agent.post('/api/transacoes/prorrogar').set('X-CSRF-Token', csrf).send({
      transacao_pai_id: recurringTransfer.body.transacao_pai_id, novos_meses: 2,
    }).expect(200);
    const extendedTransfer = await prisma.transacao.findMany({
      where: { transacao_pai_id: recurringTransfer.body.transacao_pai_id },
      orderBy: [{ parcela_atual: 'asc' }, { transferencia_direcao: 'asc' }],
    });
    expect(extendedTransfer).toHaveLength(10);
    expect(new Set(extendedTransfer.map((item) => item.parcela_atual))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(extendedTransfer.filter((item) => item.parcela_atual > 3).map((item) => item.transferencia_direcao).sort())
      .toEqual(['Entrada', 'Entrada', 'Saida', 'Saida']);
    await agent.post('/api/transacoes/cancelar-recorrencia').set('X-CSRF-Token', csrf).send({
      transacao_pai_id: recurringTransfer.body.transacao_pai_id, parcela_limite: 3,
    }).expect(200);
    const endedTransfer = await prisma.transacao.findMany({
      where: { transacao_pai_id: recurringTransfer.body.transacao_pai_id },
    });
    expect(endedTransfer).toHaveLength(6);
    expect(endedTransfer.every((item) => item.total_parcelas === 3)).toBe(true);

    const paidSeriesId = '99999999-9999-4999-8999-999999999999';
    await prisma.transacao.createMany({ data: [
      {
        usuario_id: account.body.usuario_id, conta_id: account.body.id,
        descricao: 'Recorrência já liquidada', valor: 30, tipo: 'Despesa',
        data_transacao: new Date('2026-08-05T12:00:00.000Z'), status: 'Pago',
        parcela_atual: 1, total_parcelas: 2, recorrente: true, transacao_pai_id: paidSeriesId,
      },
      {
        usuario_id: account.body.usuario_id, conta_id: account.body.id,
        descricao: 'Recorrência já liquidada', valor: 30, tipo: 'Despesa',
        data_transacao: new Date('2026-09-05T12:00:00.000Z'), status: 'Pendente',
        parcela_atual: 2, total_parcelas: 2, recorrente: true, transacao_pai_id: paidSeriesId,
      },
    ] });
    const paidSimulation = await agent.post(`/api/recorrencias/${paidSeriesId}/simular-alteracao`)
      .set('X-CSRF-Token', csrf)
      .send({ novo_valor: 35, competencia_inicial: '2026-08', escopo: 'DestaCompetenciaEmDiante' })
      .expect(200);
    expect(paidSimulation.body.pode_executar).toBe(false);
    expect(paidSimulation.body.competencias_bloqueadas).toContainEqual({
      competencia: '2026-08', motivo: 'Lançamento já pago.',
    });

    const metrics = await request(app).get('/api/metrics').expect(200);
    expect(metrics.text).toContain('kakebo_http_requests_total');
    process.env.METRICS_TOKEN = 'metrics-integration-token';
    await request(app).get('/api/metrics').expect(401);
    await request(app).get('/api/metrics').set('X-Metrics-Token', 'metrics-integration-token').expect(200);
    delete process.env.METRICS_TOKEN;
    await request(app).get('/api/health').expect(200).expect(({ body }) => expect(body.database).toBe('ok'));
  });
});
