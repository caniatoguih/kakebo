import { api } from './api';

export interface ResumoReflexao {
  total_orcado: number;
  total_realizado: number;
  saldo_geral: number;
  receitas_realizadas: number;
  despesas_realizadas: number;
  receitas_previstas: number;
  despesas_previstas: number;
  resultado_real: number;
  resultado_previsto: number;
  taxa_poupanca: number | null;
  aderencia_orcamento: number | null;
  folga_orcamento: number;
  despesas_sem_categoria: number;
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
  pilares: Record<string, PilarData>;
  comparacao_mes_anterior: {
    receitas_percentual: number | null;
    despesas_percentual: number | null;
    resultado_percentual: number | null;
  };
  historico: Array<{ competencia: string; receitas: number; despesas: number; resultado: number; orcado: number }>;
  desvios: Array<{ categoria: string; pilar: string; orcado: number; realizado: number; diferenca: number; percentual: number | null }>;
  projecao: {
    despesas_projetadas: number;
    resultado_projetado: number;
    compromissos_pendentes: number;
    percentual_orcamento_projetado: number | null;
    dias_decorridos: number;
    dias_no_mes: number;
  };
  saude: {
    despesas_essenciais: number;
    percentual_renda_essenciais: number | null;
    compromissos_recorrentes: number;
    percentual_renda_recorrencias: number | null;
    faturas_abertas: number;
    limite_cartoes: number;
    utilizacao_cartoes: number | null;
    reserva: number;
    meses_cobertura: number | null;
  };
  insights: Array<{ tipo: 'positivo' | 'atencao' | 'informativo'; titulo: string; descricao: string; destino?: string }>;
}

const finiteNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const nullableNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Mantém a Reflexão utilizável durante atualizações em que o navegador ainda
 * tenha em cache uma resposta do contrato anterior da API.
 */
export function normalizePainelReflexaoData(payload: unknown): PainelReflexaoData {
  const raw = (payload ?? {}) as Record<string, any>;
  const rawResumo = (raw.resumo ?? {}) as Record<string, unknown>;
  const totalOrcado = finiteNumber(rawResumo.total_orcado);
  const totalRealizado = finiteNumber(rawResumo.total_realizado);
  const despesasRealizadas = finiteNumber(rawResumo.despesas_realizadas, totalRealizado);
  const receitasRealizadas = finiteNumber(rawResumo.receitas_realizadas);
  const comparacao = (raw.comparacao_mes_anterior ?? {}) as Record<string, unknown>;
  const projecao = (raw.projecao ?? {}) as Record<string, unknown>;
  const saude = (raw.saude ?? {}) as Record<string, unknown>;

  return {
    mes: finiteNumber(raw.mes),
    ano: finiteNumber(raw.ano),
    resumo: {
      total_orcado: totalOrcado,
      total_realizado: totalRealizado,
      saldo_geral: finiteNumber(rawResumo.saldo_geral, totalOrcado - totalRealizado),
      receitas_realizadas: receitasRealizadas,
      despesas_realizadas: despesasRealizadas,
      receitas_previstas: finiteNumber(rawResumo.receitas_previstas),
      despesas_previstas: finiteNumber(rawResumo.despesas_previstas),
      resultado_real: finiteNumber(rawResumo.resultado_real),
      resultado_previsto: finiteNumber(rawResumo.resultado_previsto),
      taxa_poupanca: nullableNumber(rawResumo.taxa_poupanca),
      aderencia_orcamento: nullableNumber(rawResumo.aderencia_orcamento),
      folga_orcamento: finiteNumber(rawResumo.folga_orcamento, totalOrcado - despesasRealizadas),
      despesas_sem_categoria: finiteNumber(rawResumo.despesas_sem_categoria),
    },
    pilares: raw.pilares && typeof raw.pilares === 'object' ? raw.pilares : {},
    comparacao_mes_anterior: {
      receitas_percentual: nullableNumber(comparacao.receitas_percentual),
      despesas_percentual: nullableNumber(comparacao.despesas_percentual),
      resultado_percentual: nullableNumber(comparacao.resultado_percentual),
    },
    historico: Array.isArray(raw.historico) ? raw.historico : [],
    desvios: Array.isArray(raw.desvios) ? raw.desvios : [],
    projecao: {
      despesas_projetadas: finiteNumber(projecao.despesas_projetadas),
      resultado_projetado: finiteNumber(projecao.resultado_projetado),
      compromissos_pendentes: finiteNumber(projecao.compromissos_pendentes),
      percentual_orcamento_projetado: nullableNumber(projecao.percentual_orcamento_projetado),
      dias_decorridos: finiteNumber(projecao.dias_decorridos),
      dias_no_mes: finiteNumber(projecao.dias_no_mes),
    },
    saude: {
      despesas_essenciais: finiteNumber(saude.despesas_essenciais),
      percentual_renda_essenciais: nullableNumber(saude.percentual_renda_essenciais),
      compromissos_recorrentes: finiteNumber(saude.compromissos_recorrentes),
      percentual_renda_recorrencias: nullableNumber(saude.percentual_renda_recorrencias),
      faturas_abertas: finiteNumber(saude.faturas_abertas),
      limite_cartoes: finiteNumber(saude.limite_cartoes),
      utilizacao_cartoes: nullableNumber(saude.utilizacao_cartoes),
      reserva: finiteNumber(saude.reserva),
      meses_cobertura: nullableNumber(saude.meses_cobertura),
    },
    insights: Array.isArray(raw.insights) ? raw.insights : [],
  };
}

export const relatoriosService = {
  getPainelReflexao: async (mes: number, ano: number): Promise<PainelReflexaoData> => {
    const response = await api.get('/relatorios/kakebo-reflexao', {
      params: { mes, ano }
    });
    return normalizePainelReflexaoData(response.data);
  }
};
