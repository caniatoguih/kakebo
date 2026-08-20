import { describe, expect, it } from 'vitest';
import { createSalaryPlanningSchema } from '../src/schemas/api.schema';

const validBody = {
  empresa: 'Vitru',
  ano: 2027,
  salario_base: 6500,
  conta_id: '28a172f3-3690-46b6-a8bd-457512dd4762',
  subcategoria_id: 'a61788ac-ef46-4491-9deb-9909768f905c',
  ferias: [],
  bonus: [],
};

describe('validação do planejamento salarial', () => {
  it('rejeita período de férias cujo fim antecede o início', () => {
    const parsed = createSalaryPlanningSchema.safeParse({
      body: { ...validBody, ferias: [{ inicio: '2026-12-14', fim: '2026-01-02' }] },
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toBe('O fim das férias não pode ser anterior ao início.');
  });

  it('rejeita períodos de férias sobrepostos', () => {
    const parsed = createSalaryPlanningSchema.safeParse({
      body: {
        ...validBody,
        ferias: [
          { inicio: '2027-03-01', fim: '2027-03-10' },
          { inicio: '2027-03-10', fim: '2027-03-20' },
        ],
      },
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toBe('Os períodos de férias não podem se sobrepor.');
  });
});
