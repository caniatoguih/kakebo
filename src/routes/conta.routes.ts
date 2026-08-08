import { Router } from 'express';
import { ContaController } from '../controllers/ContaController';
import { requireAuth } from '../middlewares/requireAuth';
import { validateResource } from '../middlewares/validateResource';
import { contaIdSchema, createContaSchema, updateContaSchema } from '../schemas/api.schema';

const contaRoutes = Router();
const controller = new ContaController();

contaRoutes.use(requireAuth);

contaRoutes.post('/', validateResource(createContaSchema), controller.create);
contaRoutes.get('/', controller.list);
contaRoutes.put('/:id', validateResource(updateContaSchema), controller.update);
contaRoutes.delete('/:id', validateResource(contaIdSchema), controller.delete);
contaRoutes.post('/:id/recalcular', validateResource(contaIdSchema), controller.recalculate);
contaRoutes.get('/:id/faturas', validateResource(contaIdSchema), controller.getFaturas);

export default contaRoutes;
