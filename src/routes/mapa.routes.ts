import { Router } from 'express';
import { MapaController } from '../controllers/MapaController';
import { requireAuth } from '../middlewares/requireAuth';
import { validateResource } from '../middlewares/validateResource';
import { geocodeSchema, routeSchema } from '../schemas/api.schema';

const mapaRoutes = Router();
const controller = new MapaController();
mapaRoutes.use(requireAuth);
mapaRoutes.get('/geocode', validateResource(geocodeSchema), controller.geocode);
mapaRoutes.post('/routes', validateResource(routeSchema), controller.route);
export default mapaRoutes;
