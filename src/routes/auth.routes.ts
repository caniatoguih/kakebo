import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { requireAuth } from '../middlewares/requireAuth';

const authRoutes = Router();
const controller = new AuthController();

authRoutes.post('/login', controller.login);
authRoutes.post('/register', controller.register);
authRoutes.get('/me', requireAuth, controller.me);

export default authRoutes;
