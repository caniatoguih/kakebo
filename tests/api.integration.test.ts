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

    const card = await agent.post('/api/contas').set('X-CSRF-Token', csrf).send({
      nome: 'Cartão recorrência', tipo: 'CartaoCredito', saldo_inicial: 0,
      limite_total: 5000, dia_fechamento: 10, dia_vencimento: 17,
    }).expect(201);
    await agent.post('/api/transacoes').set('X-CSRF-Token', csrf).send({
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

    const metrics = await request(app).get('/api/metrics').expect(200);
    expect(metrics.text).toContain('kakebo_http_requests_total');
    process.env.METRICS_TOKEN = 'metrics-integration-token';
    await request(app).get('/api/metrics').expect(401);
    await request(app).get('/api/metrics').set('X-Metrics-Token', 'metrics-integration-token').expect(200);
    delete process.env.METRICS_TOKEN;
    await request(app).get('/api/health').expect(200).expect(({ body }) => expect(body.database).toBe('ok'));
  });
});
