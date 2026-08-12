import { describe, expect, it } from 'vitest';
import { normalizePainelReflexaoData } from './relatoriosService';

describe('normalizePainelReflexaoData', () => {
  it('completa respostas do contrato antigo sem perder o resumo e os pilares', () => {
    const legacyPayload = {
      mes: 8,
      ano: 2026,
      resumo: { total_orcado: 4000, total_realizado: 3200, saldo_geral: 800 },
      pilares: { Lazer: { orcado: 500, realizado: 300, saldo: 200, categorias: {} } },
    };

    const result = normalizePainelReflexaoData(legacyPayload);

    expect(result.resumo.despesas_realizadas).toBe(3200);
    expect(result.resumo.folga_orcamento).toBe(800);
    expect(result.comparacao_mes_anterior.receitas_percentual).toBeNull();
    expect(result.historico).toEqual([]);
    expect(result.insights).toEqual([]);
    expect(result.pilares.Lazer.realizado).toBe(300);
  });
});
