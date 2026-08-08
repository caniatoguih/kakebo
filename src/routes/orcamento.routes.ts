import { Router } from 'express';
import { OrcamentoController } from '../controllers/OrcamentoController';
import { requireAuth } from '../middlewares/requireAuth';
import { validateResource } from '../middlewares/validateResource';
import { batchOrcamentoSchema, listOrcamentoSchema, orcamentoIdSchema, upsertOrcamentoSchema } from '../schemas/api.schema';

const orcamentoRoutes = Router();
const controller = new OrcamentoController();

orcamentoRoutes.use(requireAuth);

orcamentoRoutes.get('/', validateResource(listOrcamentoSchema), controller.list);
orcamentoRoutes.post('/', validateResource(upsertOrcamentoSchema), controller.upsert);
orcamentoRoutes.post('/batch', validateResource(batchOrcamentoSchema), controller.upsertBatch);
orcamentoRoutes.delete('/:id', validateResource(orcamentoIdSchema), controller.delete);

export default orcamentoRoutes;
