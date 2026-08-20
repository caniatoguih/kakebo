import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { requireAuth } from '../middlewares/requireAuth';
import { authLimiter, passwordResetRequestLimiter } from '../middlewares/rateLimiter';
import { validateResource } from '../middlewares/validateResource';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from '../schemas/api.schema';

const authRoutes = Router();
const controller = new AuthController();

authRoutes.post('/login', authLimiter, validateResource(loginSchema), controller.login);
authRoutes.post('/register', authLimiter, validateResource(registerSchema), controller.register);
authRoutes.post('/esqueci-senha', passwordResetRequestLimiter, validateResource(forgotPasswordSchema), controller.forgotPassword);
authRoutes.post('/redefinir-senha', authLimiter, validateResource(resetPasswordSchema), controller.resetPassword);
authRoutes.get('/me', requireAuth, controller.me);
authRoutes.post('/logout', requireAuth, controller.logout);

export default authRoutes;
