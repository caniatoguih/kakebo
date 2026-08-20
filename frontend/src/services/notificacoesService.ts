import { api } from './api';

export interface PaymentReminder {
  id: string;
  tipo: 'Despesa' | 'Fatura';
  descricao: string;
  conta_nome: string;
  valor: number;
  data_vencimento: string;
}

export const notificacoesService = {
  listarContasAPagar: async (dias = 3): Promise<PaymentReminder[]> => {
    const response = await api.get('/notificacoes/contas-a-pagar', { params: { dias } });
    return response.data.lembretes;
  },
};
