import { api } from './api';

export interface OrcamentoItem {
  id: string;
  subcategoria_id: string;
  subcategoria_nome: string;
  categoria_id: string;
  categoria_nome: string;
  pilar: 'Sobrevivencia' | 'Lazer' | 'Cultura' | 'Extras';
  valor_orcado: number;
  valor_realizado: number;
  mes: number;
  ano: number;
}

export interface OrcamentoPayload {
  subcategoria_id: string;
  mes: number;
  ano: number;
  valor_orcado: number;
}

export const orcamentosService = {
  listar: async (mes: number, ano: number): Promise<OrcamentoItem[]> => {
    const response = await api.get('/orcamentos', { params: { mes, ano } });
    return response.data;
  },

  salvar: async (data: OrcamentoPayload): Promise<OrcamentoItem> => {
    const response = await api.post('/orcamentos', data);
    return response.data;
  },

  salvarBatch: async (items: OrcamentoPayload[]): Promise<OrcamentoItem[]> => {
    const response = await api.post('/orcamentos/batch', { items });
    return response.data;
  },

  deletar: async (id: string): Promise<void> => {
    await api.delete(`/orcamentos/${id}`);
  },
};
