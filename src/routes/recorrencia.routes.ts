import { Router } from 'express';
import { RecorrenciaController } from '../controllers/RecorrenciaController';
import { requireAuth } from '../middlewares/requireAuth';
import { validateResource } from '../middlewares/validateResource';
import {
  executeRecurrenceChangeSchema, listRecorrenciasSchema, recorrenciaIdSchema,
  simulateRecurrenceChangeSchema,
} from '../schemas/recorrencia.schema';

const recorrenciaRoutes = Router();
const controller = new RecorrenciaController();

recorrenciaRoutes.use(requireAuth);
recorrenciaRoutes.get('/', validateResource(listRecorrenciasSchema), controller.list);
recorrenciaRoutes.post('/:id/simular-alteracao', validateResource(simulateRecurrenceChangeSchema), controller.simulateChange);
recorrenciaRoutes.patch('/:id/valor', validateResource(executeRecurrenceChangeSchema), controller.executeChange);
recorrenciaRoutes.get('/:id', validateResource(recorrenciaIdSchema), controller.detail);

export default recorrenciaRoutes;
