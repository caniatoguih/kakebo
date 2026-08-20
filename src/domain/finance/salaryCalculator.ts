export interface SalaryVacationInput {
  inicio: string;
  fim: string;
}

export interface SalaryBonusInput {
  mes: number;
  valor: number;
  incideInss?: boolean;
  incideIrrf?: boolean;
}

export interface SalaryCalculatorInput {
  ano: number;
  salarioBase: number;
  ferias?: SalaryVacationInput[];
  bonus?: SalaryBonusInput[];
  descontosMensais?: number;
  dependentes?: number;
  melhorDeducaoIrrf?: boolean;
  pagamentoFolha?: 'mesmo' | 'seguinte';
  estimarDezembroAnterior?: boolean;
  incluirDecimoTerceiro?: boolean;
  avosDecimoTerceiro?: number;
  modoDecimoTerceiro?: 'duas' | 'unica';
  mesPrimeiraParcela13?: number;
  mesSegundaParcela13?: number;
}

export interface SalaryMonthResult {
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

export interface SalaryCashflowMonth {
  mes: number;
  competencia: string;
  origemFolha: string | null;
  folha: number;
  reciboFerias: number;
  decimoTerceiro: number;
  total: number;
}

export interface SalaryCalculationResult {
  ano: number;
  meses: SalaryMonthResult[];
  recebimentos: SalaryCashflowMonth[];
  decimoTerceiro: { bruto: number; inss: number; irrf: number; liquido: number };
  totais: { folha: number; ferias: number; decimoTerceiro: number; bonus: number; recebido: number };
}

const DEPENDENTE_IRRF = 189.59;
const DEDUCAO_SIMPLIFICADA = 607.20;
const CENT = 100;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * CENT) / CENT;
const money = (value: number) => round2(Math.max(0, value));
const dateOf = (value: string) => {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Data inválida: ${value}`);
  return date;
};
const daysInclusive = (start: Date, end: Date) => Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
const monthStart = (year: number, month: number) => new Date(Date.UTC(year, month, 1, 12));
const monthEnd = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0, 12));

function inss2026(base: number): number {
  const taxable = Math.max(0, Math.min(base, 8475.55));
  const ranges: Array<[number, number]> = [[1621, .075], [2902.84, .09], [4354.27, .12], [8475.55, .14]];
  let previous = 0;
  let total = 0;
  for (const [limit, rate] of ranges) {
    if (taxable <= previous) break;
    total += (Math.min(taxable, limit) - previous) * rate;
    previous = limit;
  }
  return round2(total);
}

function irrfTable(base: number): number {
  if (base <= 2428.80) return 0;
  if (base <= 2826.65) return base * .075 - 182.16;
  if (base <= 3751.05) return base * .15 - 394.16;
  if (base <= 4664.68) return base * .225 - 675.49;
  return base * .275 - 908.73;
}

function irrf2026(rendimento: number, deducoes: number, melhor = true): number {
  const deducao = melhor ? Math.max(deducoes, DEDUCAO_SIMPLIFICADA) : deducoes;
  const antes = Math.max(0, irrfTable(Math.max(0, rendimento - deducao)));
  const reducao = rendimento <= 5000
    ? Math.min(antes, 312.89)
    : rendimento <= 7350
      ? Math.min(antes, Math.max(0, 978.62 - .133145 * rendimento))
      : 0;
  return money(antes - reducao);
}

function daysInMonth(vacation: { inicio: Date; fim: Date }, year: number, month: number): number {
  const start = vacation.inicio > monthStart(year, month) ? vacation.inicio : monthStart(year, month);
  const end = vacation.fim < monthEnd(year, month) ? vacation.fim : monthEnd(year, month);
  return start > end ? 0 : Math.min(30, daysInclusive(start, end));
}

function sum(values: number[]): number { return round2(values.reduce((total, value) => total + value, 0)); }

function calculateSalaryForYear(input: SalaryCalculatorInput, validatePlanningYear = true): SalaryCalculationResult {
  const minimumYear = validatePlanningYear ? 2026 : 2000;
  if (!Number.isInteger(input.ano) || input.ano < minimumYear || input.ano > 2100) throw new Error('Ano inválido.');
  if (!Number.isFinite(input.salarioBase) || input.salarioBase < 0) throw new Error('Salário-base inválido.');

  const vacations = (input.ferias ?? []).map((item) => ({ inicio: dateOf(item.inicio), fim: dateOf(item.fim) }));
  vacations.forEach((item) => {
    if (item.fim < item.inicio) throw new Error('O fim das férias não pode ser anterior ao início.');
  });
  vacations.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  vacations.forEach((item, index) => {
    if (index > 0 && item.inicio <= vacations[index - 1].fim) throw new Error('Os períodos de férias não podem se sobrepor.');
  });

  const bonusByMonth = Array.from({ length: 12 }, (_, index) => {
    const items = (input.bonus ?? []).filter((item) => item.mes === index + 1);
    return {
      valor: sum(items.map((item) => item.valor)),
      inss: items.some((item) => item.incideInss === true),
      irrf: items.some((item) => item.incideIrrf !== false),
    };
  });
  const salary = input.salarioBase;
  const dependentes = Math.max(0, Math.floor(input.dependentes ?? 0));
  const descontos = money(input.descontosMensais ?? 0);
  const melhorDeducao = input.melhorDeducaoIrrf ?? true;
  const months: SalaryMonthResult[] = [];

  for (let month = 0; month < 12; month++) {
    const daysVacation = Math.min(30, sum(vacations.map((vacation) => daysInMonth(vacation, input.ano, month))));
    const daysSalary = Math.max(0, 30 - daysVacation);
    const salaryProportional = round2((salary / 30) * daysSalary);
    const vacationGross = round2((salary / 30) * daysVacation);
    const vacationThird = round2(vacationGross / 3);
    let vacationProvision = 0;
    let thirdProvision = 0;
    let vacationReceipt = 0;
    let anticipatedInss = 0;

    vacations.forEach((vacation) => {
      if (vacation.inicio.getUTCFullYear() === input.ano && vacation.inicio.getUTCMonth() === month) {
        const totalDays = daysInclusive(vacation.inicio, vacation.fim);
        const gross = round2((salary / 30) * totalDays * 4 / 3);
        let receiptInss = 0;
        for (let year = vacation.inicio.getUTCFullYear(); year <= vacation.fim.getUTCFullYear(); year++) {
          for (let receiptMonth = 0; receiptMonth < 12; receiptMonth++) {
            const days = daysInMonth(vacation, year, receiptMonth);
            if (days > 0) receiptInss = round2(receiptInss + inss2026(round2((salary / 30) * days * 4 / 3)));
          }
        }
        const receiptIrrf = irrf2026(gross, receiptInss + dependentes * DEPENDENTE_IRRF, melhorDeducao);
        vacationReceipt = round2(vacationReceipt + money(gross - receiptInss - receiptIrrf));
        const vacationValue = round2((salary / 30) * totalDays);
        vacationProvision = round2(vacationProvision + vacationValue);
        thirdProvision = round2(thirdProvision + vacationValue / 3);
      }
    });

    vacations.forEach((vacation) => {
      const days = daysInMonth(vacation, input.ano, month);
      if (days > 0) anticipatedInss = round2(anticipatedInss + inss2026(round2((salary / 30) * days * 4 / 3)));
    });

    const bonus = bonusByMonth[month].valor;
    const inss = money(inss2026(round2(salaryProportional + vacationGross + vacationThird + (bonusByMonth[month].inss ? bonus : 0))) - anticipatedInss);
    const irrf = irrf2026(round2(salaryProportional + (bonusByMonth[month].irrf ? bonus : 0)), inss + dependentes * DEPENDENTE_IRRF, melhorDeducao);
    const liquidoFolha = money(salaryProportional + vacationProvision + thirdProvision + bonus - inss - anticipatedInss - irrf - descontos - vacationReceipt);
    months.push({
      mes: month + 1,
      competencia: `${input.ano}-${String(month + 1).padStart(2, '0')}`,
      diasFerias: daysVacation,
      diasSalario: daysSalary,
      salarioProporcional: salaryProportional,
      feriasProvento: round2(vacationProvision),
      tercoFerias: round2(thirdProvision),
      reciboFerias: vacationReceipt,
      bonus,
      inss,
      irrf,
      descontos,
      liquidoFolha,
      decimoTerceiro: 0,
      recebido: 0,
    });
  }

  const decimo = { bruto: 0, inss: 0, irrf: 0, liquido: 0 };
  if (input.incluirDecimoTerceiro ?? true) {
    const avos = Math.max(1, Math.min(12, Math.floor(input.avosDecimoTerceiro ?? 12)));
    decimo.bruto = round2(salary * avos / 12);
    decimo.inss = inss2026(decimo.bruto);
    decimo.irrf = irrf2026(decimo.bruto, decimo.inss + dependentes * DEPENDENTE_IRRF, melhorDeducao);
    decimo.liquido = money(decimo.bruto - decimo.inss - decimo.irrf);
    if ((input.modoDecimoTerceiro ?? 'duas') === 'unica') {
      months[10].decimoTerceiro = decimo.liquido;
    } else {
      const firstMonth = Math.max(1, Math.min(12, input.mesPrimeiraParcela13 ?? 11)) - 1;
      const secondMonth = Math.max(1, Math.min(12, input.mesSegundaParcela13 ?? 12)) - 1;
      months[firstMonth].decimoTerceiro = round2(months[firstMonth].decimoTerceiro + decimo.bruto / 2);
      months[secondMonth].decimoTerceiro = round2(months[secondMonth].decimoTerceiro + decimo.liquido - decimo.bruto / 2);
    }
  }

  months.forEach((month) => { month.recebido = round2(month.liquidoFolha + month.reciboFerias + month.decimoTerceiro); });
  const cashflow: SalaryCashflowMonth[] = Array.from({ length: 12 }, (_, index) => ({
    mes: index + 1, competencia: `${input.ano}-${String(index + 1).padStart(2, '0')}`,
    origemFolha: null, folha: 0, reciboFerias: months[index].reciboFerias,
    decimoTerceiro: months[index].decimoTerceiro, total: round2(months[index].reciboFerias + months[index].decimoTerceiro),
  }));
  if ((input.pagamentoFolha ?? 'seguinte') === 'mesmo') {
    months.forEach((month, index) => { cashflow[index].folha = month.liquidoFolha; cashflow[index].origemFolha = month.competencia; });
  } else {
    months.slice(0, 11).forEach((month, index) => { cashflow[index + 1].folha = month.liquidoFolha; cashflow[index + 1].origemFolha = month.competencia; });
    if (input.estimarDezembroAnterior ?? true) {
      const previousYear = calculateSalaryForYear({
        ...input,
        ano: input.ano - 1,
        bonus: [],
        incluirDecimoTerceiro: false,
        pagamentoFolha: 'mesmo',
        estimarDezembroAnterior: false,
      }, false);
      cashflow[0].folha = previousYear.meses[11].liquidoFolha;
      cashflow[0].origemFolha = `${input.ano - 1}-12 (estimado)`;
    }
  }
  cashflow.forEach((month) => { month.total = round2(month.folha + month.reciboFerias + month.decimoTerceiro); });

  return {
    ano: input.ano,
    meses: months,
    recebimentos: cashflow,
    decimoTerceiro: decimo,
    totais: {
      folha: sum(months.map((month) => month.liquidoFolha)),
      ferias: sum(months.map((month) => month.reciboFerias)),
      decimoTerceiro: sum(months.map((month) => month.decimoTerceiro)),
      bonus: sum(months.map((month) => month.bonus)),
      recebido: sum(cashflow.map((month) => month.total)),
    },
  };
}

export function calculateSalary(input: SalaryCalculatorInput): SalaryCalculationResult {
  return calculateSalaryForYear(input);
}
