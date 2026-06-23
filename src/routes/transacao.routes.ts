import { Router } from 'express';
import { TransacaoController } from '../controllers/TransacaoController';
import { requireAuth } from '../middlewares/requireAuth';
import { validateResource } from '../middlewares/validateResource';
import { createTransacaoSchema, listTransacoesSchema, updateTransacaoSchema } from '../schemas/transacao.schema';

const transacaoRoutes = Router();
const controller = new TransacaoController();

transacaoRoutes.use(requireAuth);

transacaoRoutes.post('/', validateResource(createTransacaoSchema), controller.create);
transacaoRoutes.get('/', validateResource(listTransacoesSchema), controller.list);
transacaoRoutes.put('/:id', validateResource(updateTransacaoSchema), controller.update);
transacaoRoutes.delete('/:id', controller.delete);
transacaoRoutes.post('/delete-batch', controller.deleteBatch);
transacaoRoutes.post('/fechar-fatura', controller.fecharFatura);
transacaoRoutes.patch('/:id/toggle-status', controller.toggleStatus);
transacaoRoutes.post('/import', controller.importar);
transacaoRoutes.post('/reconcile-ofx', controller.conciliarOFX);
transacaoRoutes.post('/reconcile-ofx-batch', controller.conciliarOFXBatch);
transacaoRoutes.post('/convert-to-transfer', controller.converterParaTransferencia);
transacaoRoutes.post('/prorrogar', controller.prorrogarRecorrencia);
transacaoRoutes.post('/cancelar-recorrencia', controller.cancelarRecorrencia);

export default transacaoRoutes;
