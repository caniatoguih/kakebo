import { describe, expect, it } from 'vitest';
import { isSalaryCompetenceInRange, salaryLaunchDate } from '../src/domain/finance/salaryLaunch';

describe('lançamento parcial de salário', () => {
  it('usa o dia escolhido em cada competência', () => {
    expect(salaryLaunchDate('2027-11', 5).toISOString()).toBe('2027-11-05T12:00:00.000Z');
  });

  it('limita o dia ao último dia disponível no mês', () => {
    expect(salaryLaunchDate('2027-02', 31).toISOString()).toBe('2027-02-28T12:00:00.000Z');
    expect(salaryLaunchDate('2028-02', 31).toISOString()).toBe('2028-02-29T12:00:00.000Z');
  });

  it('inclui somente competências dentro do intervalo', () => {
    expect(isSalaryCompetenceInRange('2027-10', '2027-11', '2027-12')).toBe(false);
    expect(isSalaryCompetenceInRange('2027-11', '2027-11', '2027-12')).toBe(true);
    expect(isSalaryCompetenceInRange('2027-12', '2027-11', '2027-12')).toBe(true);
  });
});
