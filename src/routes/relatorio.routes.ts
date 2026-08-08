import { Router } from 'express';
import { RelatorioController } from '../controllers/RelatorioController';
import { requireAuth } from '../middlewares/requireAuth';
import { validateResource } from '../middlewares/validateResource';
import { fluxoSchema, painelSchema } from '../schemas/api.schema';

const relatorioRoutes = Router();
const controller = new RelatorioController();

relatorioRoutes.use(requireAuth);

relatorioRoutes.get('/kakebo-reflexao', validateResource(painelSchema), controller.painelReflexao);
relatorioRoutes.get('/fluxo-contabil', validateResource(fluxoSchema), controller.fluxoContabil);

export default relatorioRoutes;
