import { Router } from 'express';
import { CategoriaController } from '../controllers/CategoriaController';
import { requireAuth } from '../middlewares/requireAuth';
import { validateResource } from '../middlewares/validateResource';
import { createCategoriaSchema, createSubcategoriaSchema, subcategoriaIdSchema } from '../schemas/api.schema';

const categoriaRoutes = Router();
const controller = new CategoriaController();

categoriaRoutes.use(requireAuth);

categoriaRoutes.get('/', controller.list);
categoriaRoutes.post('/', validateResource(createCategoriaSchema), controller.create);
categoriaRoutes.post('/:id/subcategorias', validateResource(createSubcategoriaSchema), controller.createSubcategoria);
categoriaRoutes.delete('/subcategorias/:subId', validateResource(subcategoriaIdSchema), controller.deleteSubcategoria);

export default categoriaRoutes;
