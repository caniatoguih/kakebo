import { Router } from 'express';
import { RelatorioController } from '../controllers/RelatorioController';
import { requireAuth } from '../middlewares/requireAuth';

const relatorioRoutes = Router();
const controller = new RelatorioController();

relatorioRoutes.use(requireAuth);

relatorioRoutes.get('/kakebo-reflexao', controller.painelReflexao);
relatorioRoutes.get('/fluxo-contabil', controller.fluxoContabil);

export default relatorioRoutes;
