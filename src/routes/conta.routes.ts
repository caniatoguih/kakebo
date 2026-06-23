import { Router } from 'express';
import { ContaController } from '../controllers/ContaController';
import { requireAuth } from '../middlewares/requireAuth';

const contaRoutes = Router();
const controller = new ContaController();

contaRoutes.use(requireAuth);

contaRoutes.post('/', controller.create);
contaRoutes.get('/', controller.list);
contaRoutes.put('/:id', controller.update);
contaRoutes.delete('/:id', controller.delete);
contaRoutes.post('/:id/recalcular', controller.recalculate);
contaRoutes.get('/:id/faturas', controller.getFaturas);

export default contaRoutes;
