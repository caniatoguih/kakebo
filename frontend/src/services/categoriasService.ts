import { api } from './api';

export interface SubcategoriaData {
  id: string;
  nome: string;
  categoria_id: string;
}

export interface CategoriaData {
  id: string;
  nome: string;
  pilar: 'Sobrevivencia' | 'Lazer' | 'Cultura' | 'Extras';
  tipo: 'Receita' | 'Despesa';
  subcategorias: SubcategoriaData[];
}

export const categoriasService = {
  listar: async (): Promise<CategoriaData[]> => {
    const response = await api.get('/categorias');
    return response.data;
  },
  criarSubcategoria: async (categoriaId: string, nome: string): Promise<SubcategoriaData> => {
    const response = await api.post(`/categorias/${categoriaId}/subcategorias`, { nome });
    return response.data;
  },
  deletarSubcategoria: async (subId: string): Promise<void> => {
    await api.delete(`/categorias/subcategorias/${subId}`);
  }
};
