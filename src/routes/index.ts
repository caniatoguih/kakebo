import { Router } from 'express';
import transacaoRoutes from './transacao.routes';
import relatorioRoutes from './relatorio.routes';
import authRoutes from './auth.routes';
import contaRoutes from './conta.routes';
import categoriaRoutes from './categoria.routes';
import orcamentoRoutes from './orcamento.routes';
import combustivelRoutes from './combustivel.routes';
import mapaRoutes from './mapa.routes';
import veiculoUsuarioRoutes from './veiculoUsuario.routes';
import prisma from '../lib/prisma';
import { renderMetrics } from '../observability/metrics';
import auditoriaRoutes from './auditoria.routes';
import recorrenciaRoutes from './recorrencia.routes';

const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/transacoes', transacaoRoutes);
routes.use('/relatorios', relatorioRoutes);
routes.use('/contas', contaRoutes);
routes.use('/categorias', categoriaRoutes);
routes.use('/orcamentos', orcamentoRoutes);
routes.use('/combustivel', combustivelRoutes);
routes.use('/maps', mapaRoutes);
routes.use('/user/vehicles', veiculoUsuarioRoutes);
routes.use('/auditoria', auditoriaRoutes);
routes.use('/recorrencias', recorrenciaRoutes);

// Rota de health check
routes.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', database: 'ok' });
});

routes.get('/metrics', (req, res) => {
  const configuredToken = process.env.METRICS_TOKEN;
  const suppliedToken = req.header('x-metrics-token') ?? req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if ((process.env.NODE_ENV === 'production' && !configuredToken) || (configuredToken && suppliedToken !== configuredToken)) {
    return res.status(configuredToken ? 401 : 503).json({ message: 'Métricas não configuradas.' });
  }
  res.type('text/plain; version=0.0.4').send(renderMetrics());
});

export default routes;
