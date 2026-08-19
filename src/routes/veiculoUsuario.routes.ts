import { Router } from 'express';
import { VeiculoUsuarioController } from '../controllers/VeiculoUsuarioController';
import { requireAuth } from '../middlewares/requireAuth';
import { validateResource } from '../middlewares/validateResource';
import { createUserVehicleSchema, updateUserVehicleSchema, userVehicleIdSchema } from '../schemas/api.schema';

const routes = Router(); const controller = new VeiculoUsuarioController();
routes.use(requireAuth);
routes.get('/', controller.list);
routes.post('/', validateResource(createUserVehicleSchema), controller.create);
routes.put('/:id', validateResource(updateUserVehicleSchema), controller.update);
routes.delete('/:id', validateResource(userVehicleIdSchema), controller.remove);
export default routes;
