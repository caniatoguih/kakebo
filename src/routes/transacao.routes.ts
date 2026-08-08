import { Router } from 'express';
import { TransacaoController } from '../controllers/TransacaoController';
import { requireAuth } from '../middlewares/requireAuth';
import { validateResource } from '../middlewares/validateResource';
import {
  cancelRecurrenceSchema, closeInvoiceSchema, convertTransferSchema, createTransacaoSchema,
  deleteBatchSchema, extendRecurrenceSchema, importTransactionsSchema, listTransacoesSchema,
  payInvoiceSchema, reconcileOfxBatchSchema, reconcileOfxSchema, transactionIdSchema, updateTransacaoSchema
} from '../schemas/transacao.schema';

const transacaoRoutes = Router();
const controller = new TransacaoController();

transacaoRoutes.use(requireAuth);

transacaoRoutes.post('/', validateResource(createTransacaoSchema), controller.create);
transacaoRoutes.get('/', validateResource(listTransacoesSchema), controller.list);
transacaoRoutes.put('/:id', validateResource(updateTransacaoSchema), controller.update);
transacaoRoutes.delete('/:id', validateResource(transactionIdSchema), controller.delete);
transacaoRoutes.post('/delete-batch', validateResource(deleteBatchSchema), controller.deleteBatch);
transacaoRoutes.post('/fechar-fatura', validateResource(closeInvoiceSchema), controller.fecharFatura);
transacaoRoutes.post('/pagar-fatura', validateResource(payInvoiceSchema), controller.pagarFatura);
transacaoRoutes.patch('/:id/toggle-status', validateResource(transactionIdSchema), controller.toggleStatus);
transacaoRoutes.post('/import', validateResource(importTransactionsSchema), controller.importar);
transacaoRoutes.post('/reconcile-ofx', validateResource(reconcileOfxSchema), controller.conciliarOFX);
transacaoRoutes.post('/reconcile-ofx-batch', validateResource(reconcileOfxBatchSchema), controller.conciliarOFXBatch);
transacaoRoutes.post('/convert-to-transfer', validateResource(convertTransferSchema), controller.converterParaTransferencia);
transacaoRoutes.post('/prorrogar', validateResource(extendRecurrenceSchema), controller.prorrogarRecorrencia);
transacaoRoutes.post('/cancelar-recorrencia', validateResource(cancelRecurrenceSchema), controller.cancelarRecorrencia);

export default transacaoRoutes;
