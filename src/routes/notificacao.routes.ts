import { Router } from 'express';
import { NotificacaoController } from '../controllers/NotificacaoController';
import { requireAuth } from '../middlewares/requireAuth';
import { validateResource } from '../middlewares/validateResource';
import { paymentRemindersSchema } from '../schemas/notificacao.schema';

const notificacaoRoutes = Router();
const controller = new NotificacaoController();

notificacaoRoutes.use(requireAuth);
notificacaoRoutes.get('/contas-a-pagar', validateResource(paymentRemindersSchema), controller.contasAPagar);

export default notificacaoRoutes;
