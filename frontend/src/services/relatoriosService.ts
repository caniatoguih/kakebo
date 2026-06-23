import { api } from './api';

export interface ResumoReflexao {
  total_orcado: number;
  total_realizado: number;
  saldo_geral: number;
}

export interface CategoriaDetalhe {
  orcado: number;
  realizado: number;
  subcategorias: Record<string, { orcado: number; realizado: number }>;
}

export interface PilarData {
  orcado: number;
  realizado: number;
  saldo: number;
  categorias: Record<string, CategoriaDetalhe>;
}

export interface PainelReflexaoData {
  mes: number;
  ano: number;
  resumo: ResumoReflexao;
  pilares: Record<string, PilarData>; // keys: Sobrevivencia, Lazer, Cultura, Extras
}

export const relatoriosService = {
  getPainelReflexao: async (mes: number, ano: number): Promise<PainelReflexaoData> => {
    const response = await api.get('/relatorios/kakebo-reflexao', {
      params: { mes, ano }
    });
    return response.data;
  }
};
