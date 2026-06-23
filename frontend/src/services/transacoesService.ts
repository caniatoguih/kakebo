import { api } from './api';

export interface TransacaoData {
  id?: string;
  conta_id: string;
  subcategoria_id?: string;
  descricao: string;
  valor: number;
  tipo: 'Receita' | 'Despesa' | 'Transferencia';
  data_transacao: string;
  status: 'Pendente' | 'Pago';
  total_parcelas?: number;
  recorrente?: boolean;
  conta?: { nome: string };
}

export const transacoesService = {
  listar: async (params?: any): Promise<any> => {
    const response = await api.get('/transacoes', { params });
    return response.data;
  },
  criar: async (data: TransacaoData): Promise<any> => {
    const response = await api.post('/transacoes', data);
    return response.data;
  },
  editar: async (id: string, data: TransacaoData): Promise<any> => {
    const response = await api.put(`/transacoes/${id}`, data);
    return response.data;
  },
  excluir: async (id: string): Promise<any> => {
    const response = await api.delete(`/transacoes/${id}`);
    return response.data;
  },
  excluirEmLote: async (ids: string[]): Promise<any> => {
    const response = await api.post('/transacoes/delete-batch', { ids });
    return response.data;
  },
  toggleStatus: async (id: string): Promise<any> => {
    const response = await api.patch(`/transacoes/${id}/toggle-status`);
    return response.data;
  },
  importar: async (conta_id: string, transacoes: any[]): Promise<any> => {
    const response = await api.post('/transacoes/import', { conta_id, transacoes });
    return response.data;
  },
  reconciliarOFX: async (conta_id: string, ofxText: string): Promise<any> => {
    const response = await api.post('/transacoes/reconcile-ofx', { conta_id, ofxText });
    return response.data;
  },
  reconciliarOFXBatch: async (statements: Array<{ conta_id: string; ofxText: string }>): Promise<any> => {
    const response = await api.post('/transacoes/reconcile-ofx-batch', { statements });
    return response.data;
  },
  converterParaTransferencia: async (data: {
    conta_origem_id: string;
    receita_id: string;
    descricao: string;
    data_transacao: string;
    valor: number;
  }): Promise<any> => {
    const response = await api.post('/transacoes/convert-to-transfer', data);
    return response.data;
  },
  obterFluxoContabil: async (inicio: string, fim: string, status?: string, conta_id?: string): Promise<any> => {
    const response = await api.get('/relatorios/fluxo-contabil', { params: { inicio, fim, status, conta_id } });
    return response.data;
  },
  prorrogar: async (transacao_pai_id: string, novos_meses: number): Promise<any> => {
    const response = await api.post('/transacoes/prorrogar', { transacao_pai_id, novos_meses });
    return response.data;
  },
  cancelarRecorrencia: async (transacao_pai_id: string, parcela_limite: number): Promise<any> => {
    const response = await api.post('/transacoes/cancelar-recorrencia', { transacao_pai_id, parcela_limite });
    return response.data;
  }
};
