import { Router } from 'express';
import { OrcamentoController } from '../controllers/OrcamentoController';
import { requireAuth } from '../middlewares/requireAuth';

const orcamentoRoutes = Router();
const controller = new OrcamentoController();

orcamentoRoutes.use(requireAuth);

orcamentoRoutes.get('/', controller.list);
orcamentoRoutes.post('/', controller.upsert);
orcamentoRoutes.post('/batch', controller.upsertBatch);
orcamentoRoutes.delete('/:id', controller.delete);

export default orcamentoRoutes;
