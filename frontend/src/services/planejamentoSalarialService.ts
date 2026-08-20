import { api } from './api';

export interface FeriasPlanejadas {
  id?: string;
  inicio: string;
  fim: string;
}

export interface BonusPlanejado {
  id?: string;
  mes: number;
  valor: number;
  incide_inss?: boolean;
  incide_irrf?: boolean;
}

export interface PlanejamentoSalarialPayload {
  empresa: string;
  ano: number;
  salario_base: number;
  conta_id: string;
  subcategoria_id: string;
  pagamento_folha: 'mesmo' | 'seguinte';
  estimar_dezembro_anterior: boolean;
  incluir_decimo_terceiro: boolean;
  avos_decimo_terceiro: number;
  modo_decimo_terceiro: 'duas' | 'unica';
  mes_primeira_parcela_13: number;
  mes_segunda_parcela_13: number;
  descontos_mensais: number;
  vale_alimentacao: number;
  odontologico: number;
  assistencia_medica: number;
  outros_descontos: number;
  dependentes: number;
  melhor_deducao_irrf: boolean;
  ferias: FeriasPlanejadas[];
  bonus: BonusPlanejado[];
}

export interface PlanejamentoSalarial extends PlanejamentoSalarialPayload {
  id: string;
  ferias: Array<FeriasPlanejadas & { id: string }>;
  bonus: Array<BonusPlanejado & { id: string }>;
  lancamentos?: Array<{ id: string; competencia: string; tipo_evento: string; valor: number; transacao?: { status: string } }>;
}

export interface MesCalculoSalarial {
  mes: number;
  competencia: string;
  diasFerias: number;
  diasSalario: number;
  salarioProporcional: number;
  feriasProvento: number;
  tercoFerias: number;
  reciboFerias: number;
  bonus: number;
  inss: number;
  irrf: number;
  descontos: number;
  liquidoFolha: number;
  decimoTerceiro: number;
  recebido: number;
}

export interface ResultadoCalculoSalarial {
  ano: number;
  meses: MesCalculoSalarial[];
  recebimentos: Array<{ mes: number; competencia: string; origemFolha: string | null; folha: number; reciboFerias: number; decimoTerceiro: number; total: number }>;
  decimoTerceiro: { bruto: number; inss: number; irrf: number; liquido: number };
  totais: { folha: number; ferias: number; decimoTerceiro: number; bonus: number; recebido: number };
}

export interface ResultadoLancamentoSalarial {
  message: string;
  ignorados_pago: number;
  removidos_pendentes: number;
}

export interface OpcoesLancamentoSalarial {
  competencia_inicial: string;
  competencia_final: string;
  dia_lancamento: number;
}

export const planejamentoSalarialService = {
  listar: async (): Promise<PlanejamentoSalarial[]> => (await api.get('/planejamento-salarial')).data,
  criar: async (payload: PlanejamentoSalarialPayload): Promise<PlanejamentoSalarial> => (await api.post('/planejamento-salarial', payload)).data,
  atualizar: async (id: string, payload: PlanejamentoSalarialPayload): Promise<PlanejamentoSalarial> => (await api.put(`/planejamento-salarial/${id}`, payload)).data,
  excluir: async (id: string): Promise<{ message: string; lancamentos_pendentes_removidos: number; lancamentos_pagos_preservados: number }> => (await api.delete(`/planejamento-salarial/${id}`)).data,
  calcular: async (id: string): Promise<ResultadoCalculoSalarial> => (await api.post(`/planejamento-salarial/${id}/calcular`)).data,
  lancar: async (id: string, options: OpcoesLancamentoSalarial): Promise<ResultadoLancamentoSalarial> => (await api.post(`/planejamento-salarial/${id}/lancar`, options)).data,
};
