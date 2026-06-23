import { Router } from 'express';
import { CategoriaController } from '../controllers/CategoriaController';
import { requireAuth } from '../middlewares/requireAuth';

const categoriaRoutes = Router();
const controller = new CategoriaController();

categoriaRoutes.use(requireAuth);

categoriaRoutes.get('/', controller.list);
categoriaRoutes.post('/', controller.create);
categoriaRoutes.post('/:id/subcategorias', controller.createSubcategoria);
categoriaRoutes.delete('/subcategorias/:subId', controller.deleteSubcategoria);

export default categoriaRoutes;
