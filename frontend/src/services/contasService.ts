import { api } from './api';
import type { ApiMessage } from './transacoesService';

export interface ContaData {
  id: string;
  nome: string;
  tipo: 'Corrente' | 'Poupanca' | 'Dinheiro' | 'CartaoCredito';
  saldo_inicial?: number;
  saldo_atual?: number;
  fatura_atual?: number;
  fatura_fechada?: number;
  fatura_fechada_id?: string;
  fatura_fechada_competencia?: string;
  fatura_fechada_vencimento?: string;
  cartao_detalhe?: {
    limite_total: number;
    dia_fechamento: number;
    dia_vencimento: number;
    conta_pagamento_padrao_id?: string | null;
  } | null;
}

export interface TransacaoFaturaData {
  id: string; descricao: string; valor: number | string;
  tipo: 'Despesa' | 'Receita' | 'Transferencia'; data_transacao: string;
  parcela_atual: number; total_parcelas: number; recorrente?: boolean;
  transacao_pai_id?: string; impacto_fatura: number;
}

export interface FaturaData {
  id?: string; mes: string; status?: 'Aberta' | 'Fechada' | 'ParcialmentePaga' | 'Paga' | 'Vencida';
  data_fechamento?: string; data_vencimento?: string; total: number; total_pago: number;
  saldo_restante?: number; transacoes: TransacaoFaturaData[];
}

export interface FaturasResponse {
  conta: { id: string; nome: string; limite_total: number; dia_fechamento: number; dia_vencimento: number };
  faturas: FaturaData[];
}

export const contasService = {
  listar: async (): Promise<ContaData[]> => {
    const response = await api.get('/contas');
    return response.data;
  },
  criar: async (data: Omit<ContaData, 'id'>): Promise<ContaData> => {
    const response = await api.post('/contas', data);
    return response.data;
  },
  atualizar: async (id: string, data: Partial<ContaData>): Promise<ContaData> => {
    const response = await api.put(`/contas/${id}`, data);
    return response.data;
  },
  excluir: async (id: string): Promise<ApiMessage> => {
    const response = await api.delete(`/contas/${id}`);
    return response.data;
  },
  obterFaturas: async (id: string): Promise<FaturasResponse> => {
    const response = await api.get(`/contas/${id}/faturas`);
    return response.data;
  }
};
