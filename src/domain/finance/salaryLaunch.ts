export function salaryLaunchDate(competence: string, requestedDay: number): Date {
  const match = competence.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) throw new Error('Competência de lançamento inválida.');
  if (!Number.isInteger(requestedDay) || requestedDay < 1 || requestedDay > 31) throw new Error('Dia de lançamento inválido.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1, Math.min(requestedDay, lastDay), 12));
}

export function isSalaryCompetenceInRange(competence: string, initial: string, final: string): boolean {
  return competence >= initial && competence <= final;
}
