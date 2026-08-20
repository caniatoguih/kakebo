import { Router } from 'express';
import { PlanejamentoSalarialController } from '../controllers/PlanejamentoSalarialController';
import { requireAuth } from '../middlewares/requireAuth';
import { validateResource } from '../middlewares/validateResource';
import { createSalaryPlanningSchema, launchSalaryPlanningSchema, salaryPlanningIdSchema, updateSalaryPlanningSchema } from '../schemas/api.schema';

const routes = Router();
const controller = new PlanejamentoSalarialController();
routes.use(requireAuth);
routes.get('/', controller.list);
routes.get('/:id', validateResource(salaryPlanningIdSchema), controller.get);
routes.post('/', validateResource(createSalaryPlanningSchema), controller.create);
routes.put('/:id', validateResource(updateSalaryPlanningSchema), controller.update);
routes.delete('/:id', validateResource(salaryPlanningIdSchema), controller.delete);
routes.post('/:id/calcular', validateResource(salaryPlanningIdSchema), controller.calculate);
routes.post('/:id/lancar', validateResource(launchSalaryPlanningSchema), controller.launch);
export default routes;
