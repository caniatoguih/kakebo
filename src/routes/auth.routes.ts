import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { requireAuth } from '../middlewares/requireAuth';
import { authLimiter } from '../middlewares/rateLimiter';
import { validateResource } from '../middlewares/validateResource';
import { loginSchema, registerSchema } from '../schemas/api.schema';

const authRoutes = Router();
const controller = new AuthController();

authRoutes.post('/login', authLimiter, validateResource(loginSchema), controller.login);
authRoutes.post('/register', authLimiter, validateResource(registerSchema), controller.register);
authRoutes.get('/me', requireAuth, controller.me);
authRoutes.post('/logout', requireAuth, controller.logout);

export default authRoutes;
