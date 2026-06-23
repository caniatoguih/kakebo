import { api } from './api';

export interface ContaData {
  id?: string;
  nome: string;
  tipo: 'Corrente' | 'Poupanca' | 'Dinheiro' | 'CartaoCredito';
  saldo_inicial?: number;
  saldo_atual?: number;
  fatura_atual?: number;
  cartao_detalhe?: {
    limite_total: number;
    dia_fechamento: number;
    dia_vencimento: number;
    conta_pagamento_padrao_id?: string | null;
  } | null;
}

export const contasService = {
  listar: async (): Promise<any> => {
    const response = await api.get('/contas');
    return response.data;
  },
  criar: async (data: any): Promise<any> => {
    const response = await api.post('/contas', data);
    return response.data;
  },
  atualizar: async (id: string, data: any): Promise<any> => {
    const response = await api.put(`/contas/${id}`, data);
    return response.data;
  },
  excluir: async (id: string): Promise<any> => {
    const response = await api.delete(`/contas/${id}`);
    return response.data;
  },
  obterFaturas: async (id: string): Promise<any> => {
    const response = await api.get(`/contas/${id}/faturas`);
    return response.data;
  }
};
