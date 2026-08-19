import { Router } from 'express';
import { CombustivelController } from '../controllers/CombustivelController';
import { requireAuth } from '../middlewares/requireAuth';
import { validateResource } from '../middlewares/validateResource';
import { fuelCalculationSchema, fuelSaveSchema, fuelPriceSchema, fuelScenarioApplySchema, fuelScenarioIdSchema } from '../schemas/api.schema';

const combustivelRoutes = Router();
const controller = new CombustivelController();

combustivelRoutes.use(requireAuth);
combustivelRoutes.get('/cenarios', controller.list);
combustivelRoutes.get('/precos', controller.listPrices);
combustivelRoutes.put('/precos', validateResource(fuelPriceSchema), controller.savePrice);
combustivelRoutes.delete('/cenarios/:id', validateResource(fuelScenarioIdSchema), controller.delete);
combustivelRoutes.post('/cenarios/:id/aplicar', validateResource(fuelScenarioApplySchema), controller.apply);
combustivelRoutes.post('/calcular', validateResource(fuelCalculationSchema), controller.calculate);
combustivelRoutes.post('/salvar', validateResource(fuelSaveSchema), controller.save);

export default combustivelRoutes;
