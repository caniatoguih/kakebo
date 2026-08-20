export const chartToneClasses = {
  income: 'bg-chart-income',
  expense: 'bg-chart-expense',
  extra: 'bg-chart-extra',
  leisure: 'bg-chart-leisure',
  culture: 'bg-chart-culture',
} as const;

export const chartToneSoftClasses = {
  income: 'bg-chart-income/35',
  expense: 'bg-chart-expense/35',
  extra: 'bg-chart-extra/35',
  leisure: 'bg-chart-leisure/35',
  culture: 'bg-chart-culture/35',
} as const;

export type ChartTone = keyof typeof chartToneClasses;
