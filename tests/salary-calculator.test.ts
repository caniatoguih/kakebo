import { describe, expect, it } from 'vitest';
import { calculateSalary } from '../src/domain/finance/salaryCalculator';

describe('calculateSalary', () => {
  it('calcula salário normal e desloca a folha para o mês seguinte', () => {
    const result = calculateSalary({ ano: 2026, salarioBase: 5327.94, incluirDecimoTerceiro: false });
    expect(result.meses).toHaveLength(12);
    expect(result.meses.every((month) => month.diasFerias === 0)).toBe(true);
    expect(result.recebimentos[0].folha).toBeGreaterThan(0);
    expect(result.recebimentos[1].folha).toBe(result.meses[0].liquidoFolha);
  });

  it('antecipa recibo e reduz a folha na competência de férias', () => {
    const result = calculateSalary({
      ano: 2026,
      salarioBase: 5327.94,
      ferias: [{ inicio: '2026-02-18', fim: '2026-03-04' }],
      incluirDecimoTerceiro: false,
    });
    expect(result.meses[1].diasFerias).toBe(11);
    expect(result.meses[2].diasFerias).toBe(4);
    expect(result.meses[1].reciboFerias).toBeGreaterThan(0);
    expect(result.meses[1].feriasProvento).toBeGreaterThan(0);
    expect(result.meses[2].feriasProvento).toBe(0);
  });

  it('calcula o décimo terceiro em duas parcelas', () => {
    const result = calculateSalary({ ano: 2026, salarioBase: 3000, modoDecimoTerceiro: 'duas' });
    expect(result.decimoTerceiro.bruto).toBe(3000);
    expect(result.totais.decimoTerceiro).toBeCloseTo(result.decimoTerceiro.liquido, 2);
    expect(result.meses[10].decimoTerceiro).toBeGreaterThan(0);
    expect(result.meses[11].decimoTerceiro).toBeGreaterThan(0);
  });

  it('rejeita férias sobrepostas', () => {
    expect(() => calculateSalary({
      ano: 2026,
      salarioBase: 3000,
      ferias: [
        { inicio: '2026-02-01', fim: '2026-02-10' },
        { inicio: '2026-02-10', fim: '2026-02-20' },
      ],
    })).toThrow('não podem se sobrepor');
  });

  it('estima janeiro pela competência de dezembro do ano anterior', () => {
    const baseline = calculateSalary({ ano: 2026, salarioBase: 5000, incluirDecimoTerceiro: false });
    const withCurrentDecemberVacation = calculateSalary({
      ano: 2026,
      salarioBase: 5000,
      incluirDecimoTerceiro: false,
      ferias: [{ inicio: '2026-12-10', fim: '2026-12-20' }],
    });
    expect(withCurrentDecemberVacation.recebimentos[0].folha).toBe(baseline.recebimentos[0].folha);
    expect(withCurrentDecemberVacation.recebimentos[11].folha).toBe(withCurrentDecemberVacation.meses[10].liquidoFolha);
  });
});
