import { api } from './api';

export type RecurrenceType = 'Receita' | 'Despesa' | 'Transferencia';
export type RecurrenceState = 'Ativa' | 'Encerrada' | 'Inconsistente';

export interface RecurrenceAccount {
  id: string;
  nome: string;
  tipo: 'Corrente' | 'Poupanca' | 'Dinheiro' | 'CartaoCredito';
}

export interface RecurrenceSummary {
  id: string;
  descricao: string;
  tipo: RecurrenceType;
  valor_atual: number;
  situacao: RecurrenceState;
  conta_origem: RecurrenceAccount;
  conta_destino: RecurrenceAccount | null;
  subcategoria: { id: string; nome: string; categoria: string } | null;
  primeira_competencia: string;
  proxima_competencia: string | null;
  ultima_competencia: string;
  ocorrencias_geradas: number;
  total_previsto: number;
}

export interface RecurrenceOccurrence {
  id: string;
  competencia: string;
  data_transacao: string;
  valor: number;
  status: 'Pago' | 'Pendente';
  parcela_atual: number;
  total_parcelas: number;
  fatura_id: string | null;
  conta: RecurrenceAccount;
  transferencia_grupo_id: string | null;
  transferencia_direcao: 'Entrada' | 'Saida' | null;
}

export interface RecurrenceDetail extends RecurrenceSummary {
  ocorrencias: RecurrenceOccurrence[];
  historico: RecurrenceAuditEvent[];
}

export interface RecurrenceAuditEvent {
  id: string;
  acao: 'CRIAR_RECORRENCIA' | 'CRIAR_TRANSFERENCIA_RECORRENTE' | 'ALTERAR_VALOR_RECORRENCIA' | string;
  data_criacao: string;
  request_id: string | null;
  dados: {
    competencia_inicial?: string;
    escopo?: RecurrenceChangeScope;
    novo_valor?: number;
    quantidade?: number;
    valores_anteriores?: Array<{ transacao_id: string; competencia: string; valor: number }>;
    faturas_afetadas?: string[];
  } | null;
}

export interface RecurrenceFilters {
  busca?: string;
  tipo?: RecurrenceType;
  conta_id?: string;
  situacao?: RecurrenceState;
  page: number;
  limit: number;
}

export interface RecurrenceListResponse {
  recorrencias: RecurrenceSummary[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export type RecurrenceChangeScope = 'SomenteCompetencia' | 'DestaCompetenciaEmDiante';

export interface RecurrenceChangeInput {
  novo_valor: number;
  competencia_inicial: string;
  escopo: RecurrenceChangeScope;
}

export interface RecurrenceChangeSimulation {
  simulacao_id: string;
  serie_id: string;
  valor_atual: number | null;
  novo_valor: number;
  competencia_inicial: string;
  escopo: RecurrenceChangeScope;
  ocorrencias_afetadas: number;
  lancamentos_afetados: number;
  diferenca_total: number;
  contas_afetadas: string[];
  faturas_afetadas: string[];
  faturas_fechadas: Array<{ id: string; competencia: string; status: string }>;
  competencias_bloqueadas: Array<{ competencia: string; motivo: string }>;
  requer_confirmacao_fatura_fechada: boolean;
  pode_executar: boolean;
}

export interface RecurrenceChangeResult {
  message: string;
  ocorrencias_afetadas: number;
  lancamentos_afetados: number;
  faturas_recalculadas: number;
}

export const recorrenciasService = {
  listar: async (filters: RecurrenceFilters): Promise<RecurrenceListResponse> => {
    const response = await api.get('/recorrencias', { params: filters });
    return response.data;
  },
  obter: async (id: string): Promise<RecurrenceDetail> => {
    const response = await api.get(`/recorrencias/${id}`);
    return response.data;
  },
  simularAlteracao: async (id: string, input: RecurrenceChangeInput): Promise<RecurrenceChangeSimulation> => {
    const response = await api.post(`/recorrencias/${id}/simular-alteracao`, input);
    return response.data;
  },
  alterarValor: async (
    id: string,
    input: RecurrenceChangeInput & { simulacao_id: string; confirmar_faturas_fechadas: boolean },
  ): Promise<RecurrenceChangeResult> => {
    const response = await api.patch(`/recorrencias/${id}/valor`, input);
    return response.data;
  },
};
