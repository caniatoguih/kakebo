import { Router } from 'express';
import transacaoRoutes from './transacao.routes';
import relatorioRoutes from './relatorio.routes';
import authRoutes from './auth.routes';
import contaRoutes from './conta.routes';
import categoriaRoutes from './categoria.routes';
import orcamentoRoutes from './orcamento.routes';

const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/transacoes', transacaoRoutes);
routes.use('/relatorios', relatorioRoutes);
routes.use('/contas', contaRoutes);
routes.use('/categorias', categoriaRoutes);
routes.use('/orcamentos', orcamentoRoutes);

// Rota de health check
routes.get('/health', (req, res) => res.json({ status: 'ok' }));

export default routes;
