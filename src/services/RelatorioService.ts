import { OrcamentoRepository } from '../repositories/OrcamentoRepository';
import { TransacaoRepository } from '../repositories/TransacaoRepository';
import { PilarKakebo } from '../domain/enums/PilarKakebo';
import prisma from '../lib/prisma';
import { getCashFlowMonthForCardTransaction } from '../domain/billing/billingCycle';

function getMonthsRange(inicioStr: string, fimStr: string): string[] {
  const months: string[] = [];
  const [startY, startM] = inicioStr.split('-').map(Number);
  const [endY, endM] = fimStr.split('-').map(Number);

  let currentY = startY;
  let currentM = startM;

  while (currentY < endY || (currentY === endY && currentM <= endM)) {
    const monthStr = String(currentM).padStart(2, '0');
    months.push(`${currentY}-${monthStr}`);

    currentM += 1;
    if (currentM > 12) {
      currentM = 1;
      currentY += 1;
    }
  }

  return months;
}

function getPaymentMonthAndYear(dataTransacao: Date, diaFechamento: number): { month: number; year: number } {
  const d = new Date(dataTransacao);
  const day = d.getUTCDate();
  let year = d.getUTCFullYear();
  let month = d.getUTCMonth(); // 0-indexed

  if (day >= diaFechamento) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  // O pagamento ocorre no mês seguinte
  month += 1;
  if (month > 11) {
    month = 0;
    year += 1;
  }

  return { month, year };
}

function getPaymentMonthStr(dataTransacao: Date, diaFechamento: number): string {
  const { month, year } = getPaymentMonthAndYear(dataTransacao, diaFechamento);
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function getNormalAccountMonthStr(dataTransacao: Date): string {
  const d = new Date(dataTransacao);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function isInvoicePayment(descricao: string): boolean {
  const descLower = (descricao || '').toLowerCase();
  return descLower.includes('pagamento fatura') || descLower.includes('liquidação fatura') || descLower.includes('liquidacao fatura');
}

const formatBRL = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
}).format(value);

export class RelatorioService {
  private orcamentoRepo = new OrcamentoRepository();
  private transacaoRepo = new TransacaoRepository();

  private async getReflectionMonth(usuarioId: string, mes: number, ano: number) {
    const [orcamentos, transactionResult] = await Promise.all([
      this.orcamentoRepo.findByMesAno(usuarioId, mes, ano),
      this.transacaoRepo.findByFilters({ usuario_id: usuarioId, mes, ano, page: 1, limit: 10000 }),
    ]);
    const transacoes = transactionResult.transacoes;
    const expenses = transacoes.filter((transaction) => transaction.tipo === 'Despesa');
    const revenues = transacoes.filter((transaction) => transaction.tipo === 'Receita');
    const sum = (items: typeof transacoes) => items.reduce((total, item) => total + Number(item.valor), 0);

    return {
      mes,
      ano,
      competencia: `${ano}-${String(mes).padStart(2, '0')}`,
      orcamentos,
      transacoes,
      totalOrcado: orcamentos.reduce((total, budget) => total + Number(budget.valor_orcado), 0),
      receitasRealizadas: sum(revenues.filter((item) => item.status === 'Pago')),
      receitasPrevistas: sum(revenues.filter((item) => item.status === 'Pendente')),
      despesasRealizadas: sum(expenses.filter((item) => item.status === 'Pago')),
      despesasPrevistas: sum(expenses.filter((item) => item.status === 'Pendente')),
      despesasSemCategoria: sum(expenses.filter((item) => item.status === 'Pago' && !item.subcategoria)),
    };
  }

  async gerarPainelReflexao(usuario_id: string, mes: number, ano: number) {
    const monthDates = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(Date.UTC(ano, mes - 1 - (5 - index), 1));
      return { mes: date.getUTCMonth() + 1, ano: date.getUTCFullYear() };
    });
    const snapshots = await Promise.all(monthDates.map((date) => this.getReflectionMonth(usuario_id, date.mes, date.ano)));
    const current = snapshots[snapshots.length - 1];
    const previous = snapshots[snapshots.length - 2];

    const pilares = {
      [PilarKakebo.SOBREVIVENCIA]: { orcado: 0, realizado: 0, saldo: 0, categorias: {} as any },
      [PilarKakebo.LAZER]: { orcado: 0, realizado: 0, saldo: 0, categorias: {} as any },
      [PilarKakebo.CULTURA]: { orcado: 0, realizado: 0, saldo: 0, categorias: {} as any },
      [PilarKakebo.EXTRAS]: { orcado: 0, realizado: 0, saldo: 0, categorias: {} as any },
    };

    current.orcamentos.forEach((budget) => {
      const pilar = budget.subcategoria.categoria.pilar as PilarKakebo;
      const categoryName = budget.subcategoria.categoria.nome;
      const subcategoryName = budget.subcategoria.nome;
      const value = Number(budget.valor_orcado);
      pilares[pilar].orcado += value;
      if (!pilares[pilar].categorias[categoryName]) {
        pilares[pilar].categorias[categoryName] = { orcado: 0, realizado: 0, subcategorias: {} };
      }
      pilares[pilar].categorias[categoryName].orcado += value;
      pilares[pilar].categorias[categoryName].subcategorias[subcategoryName] = { orcado: value, realizado: 0 };
    });

    current.transacoes
      .filter((transaction) => transaction.tipo === 'Despesa' && transaction.status === 'Pago' && transaction.subcategoria)
      .forEach((transaction) => {
        const pilar = transaction.subcategoria!.categoria.pilar as PilarKakebo;
        const categoryName = transaction.subcategoria!.categoria.nome;
        const subcategoryName = transaction.subcategoria!.nome;
        const value = Number(transaction.valor);
        pilares[pilar].realizado += value;
        if (!pilares[pilar].categorias[categoryName]) {
          pilares[pilar].categorias[categoryName] = { orcado: 0, realizado: 0, subcategorias: {} };
        }
        pilares[pilar].categorias[categoryName].realizado += value;
        if (!pilares[pilar].categorias[categoryName].subcategorias[subcategoryName]) {
          pilares[pilar].categorias[categoryName].subcategorias[subcategoryName] = { orcado: 0, realizado: 0 };
        }
        pilares[pilar].categorias[categoryName].subcategorias[subcategoryName].realizado += value;
      });

    Object.values(pilares).forEach((pilar) => { pilar.saldo = pilar.orcado - pilar.realizado; });

    const resultadoReal = current.receitasRealizadas - current.despesasRealizadas;
    const resultadoPrevisto = current.receitasRealizadas + current.receitasPrevistas
      - current.despesasRealizadas - current.despesasPrevistas;
    const percentageChange = (value: number, oldValue: number) => oldValue === 0 ? null : ((value - oldValue) / oldValue) * 100;
    const today = new Date();
    const isCurrentMonth = today.getUTCFullYear() === ano && today.getUTCMonth() + 1 === mes;
    const daysInMonth = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const elapsedDays = isCurrentMonth ? Math.max(1, today.getUTCDate()) : daysInMonth;
    const isSurvivalExpense = (transaction: typeof current.transacoes[number]) =>
      transaction.tipo === 'Despesa' && transaction.subcategoria?.categoria.pilar === PilarKakebo.SOBREVIVENCIA;
    const essentialRealized = current.transacoes
      .filter((transaction) => isSurvivalExpense(transaction) && transaction.status === 'Pago')
      .reduce((total, transaction) => total + Number(transaction.valor), 0);
    const essentialPending = current.transacoes
      .filter((transaction) => isSurvivalExpense(transaction) && transaction.status === 'Pendente')
      .reduce((total, transaction) => total + Number(transaction.valor), 0);
    const variableRealized = Math.max(0, current.despesasRealizadas - essentialRealized);
    const variablePending = Math.max(0, current.despesasPrevistas - essentialPending);
    const variableBudget = Math.max(0, current.totalOrcado - pilares[PilarKakebo.SOBREVIVENCIA].orcado);
    const variablePace = isCurrentMonth ? (variableRealized / elapsedDays) * daysInMonth : variableRealized;
    const cappedVariablePace = variableBudget > 0 ? Math.min(variablePace, variableBudget * 1.25) : variablePace;
    const projectedExpenses = isCurrentMonth
      ? essentialRealized + essentialPending + Math.max(variableRealized + variablePending, cappedVariablePace)
      : current.despesasRealizadas + current.despesasPrevistas;
    const projectedResult = current.receitasRealizadas + current.receitasPrevistas - projectedExpenses;

    const deviations = Object.entries(pilares).flatMap(([pillar, pillarData]) =>
      Object.entries(pillarData.categorias).map(([category, categoryData]: [string, any]) => ({
        categoria: category,
        pilar: pillar,
        orcado: categoryData.orcado,
        realizado: categoryData.realizado,
        diferenca: categoryData.realizado - categoryData.orcado,
        percentual: categoryData.orcado > 0 ? ((categoryData.realizado - categoryData.orcado) / categoryData.orcado) * 100 : null,
      })),
    ).sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));

    const [accounts, openInvoices] = await Promise.all([
      prisma.contaBancaria.findMany({ where: { usuario_id }, include: { cartao_detalhe: true } }),
      prisma.faturaCartao.findMany({ where: { usuario_id, status: { not: 'Paga' } } }),
    ]);
    const reserveBalance = accounts
      .filter((account) => account.tipo === 'Poupanca')
      .reduce((total, account) => total + Math.max(0, Number(account.saldo_atual)), 0);
    const totalCardLimit = accounts.reduce((total, account) => total + Number(account.cartao_detalhe?.limite_total ?? 0), 0);
    const openInvoiceValue = openInvoices.reduce((total, invoice) => total + Math.max(0, Number(invoice.total) - Number(invoice.total_pago)), 0);
    const essentialHistory = snapshots.map((snapshot) => {
      const survival = snapshot.transacoes
        .filter((transaction) => transaction.tipo === 'Despesa' && transaction.status === 'Pago' && transaction.subcategoria?.categoria.pilar === PilarKakebo.SOBREVIVENCIA)
        .reduce((sum, transaction) => sum + Number(transaction.valor), 0);
      return survival;
    }).filter((value) => value > 0);
    const essentialAverage = essentialHistory.length > 0
      ? essentialHistory.reduce((total, value) => total + value, 0) / essentialHistory.length
      : 0;
    const recurringCommitments = current.transacoes
      .filter((transaction) => transaction.tipo === 'Despesa' && transaction.recorrente)
      .reduce((total, transaction) => total + Number(transaction.valor), 0);
    const essentialCurrent = essentialRealized;

    const insights: Array<{ tipo: 'positivo' | 'atencao' | 'informativo'; titulo: string; descricao: string; destino?: string }> = [];
    if (current.despesasSemCategoria > 0) insights.push({ tipo: 'atencao', titulo: 'Há despesas sem categoria', descricao: `${formatBRL(current.despesasSemCategoria)} em gastos não entram na análise dos pilares.`, destino: '/transacoes' });
    if (current.totalOrcado > 0 && projectedExpenses > current.totalOrcado) insights.push({ tipo: 'atencao', titulo: 'Orçamento pode ser ultrapassado', descricao: `A projeção indica excesso de ${formatBRL(projectedExpenses - current.totalOrcado)} até o fechamento.`, destino: `/planejamento?mes=${current.competencia}` });
    if (previous && current.despesasRealizadas < previous.despesasRealizadas) insights.push({ tipo: 'positivo', titulo: 'Despesas em queda', descricao: `Você gastou ${Math.abs(percentageChange(current.despesasRealizadas, previous.despesasRealizadas) ?? 0).toFixed(0)}% menos que no mês anterior.` });
    if (resultadoReal > 0 && current.receitasRealizadas > 0) insights.push({ tipo: 'positivo', titulo: 'Mês com resultado positivo', descricao: `A taxa de poupança realizada está em ${((resultadoReal / current.receitasRealizadas) * 100).toFixed(1)}%.` });
    const largestDeviation = deviations.find((deviation) => deviation.diferenca > 0);
    if (largestDeviation) insights.push({ tipo: 'informativo', titulo: `${largestDeviation.categoria} merece atenção`, descricao: `O realizado está ${formatBRL(largestDeviation.diferenca)} acima do valor planejado.`, destino: `/transacoes?periodo=Mes&mes=${current.competencia}` });

    return {
      mes,
      ano,
      resumo: {
        total_orcado: current.totalOrcado,
        total_realizado: current.despesasRealizadas,
        saldo_geral: current.totalOrcado - current.despesasRealizadas,
        receitas_realizadas: current.receitasRealizadas,
        despesas_realizadas: current.despesasRealizadas,
        receitas_previstas: current.receitasPrevistas,
        despesas_previstas: current.despesasPrevistas,
        resultado_real: resultadoReal,
        resultado_previsto: resultadoPrevisto,
        taxa_poupanca: current.receitasRealizadas > 0 ? (resultadoReal / current.receitasRealizadas) * 100 : null,
        aderencia_orcamento: current.totalOrcado > 0 ? (current.despesasRealizadas / current.totalOrcado) * 100 : null,
        folga_orcamento: current.totalOrcado - current.despesasRealizadas,
        despesas_sem_categoria: current.despesasSemCategoria,
      },
      comparacao_mes_anterior: {
        receitas_percentual: percentageChange(current.receitasRealizadas, previous.receitasRealizadas),
        despesas_percentual: percentageChange(current.despesasRealizadas, previous.despesasRealizadas),
        resultado_percentual: percentageChange(resultadoReal, previous.receitasRealizadas - previous.despesasRealizadas),
      },
      historico: snapshots.map((snapshot) => ({
        competencia: snapshot.competencia,
        receitas: snapshot.receitasRealizadas,
        despesas: snapshot.despesasRealizadas,
        resultado: snapshot.receitasRealizadas - snapshot.despesasRealizadas,
        orcado: snapshot.totalOrcado,
      })),
      projecao: {
        despesas_projetadas: projectedExpenses,
        resultado_projetado: projectedResult,
        compromissos_pendentes: current.despesasPrevistas,
        percentual_orcamento_projetado: current.totalOrcado > 0 ? (projectedExpenses / current.totalOrcado) * 100 : null,
        dias_decorridos: elapsedDays,
        dias_no_mes: daysInMonth,
      },
      saude: {
        despesas_essenciais: essentialCurrent,
        percentual_renda_essenciais: current.receitasRealizadas > 0 ? (essentialCurrent / current.receitasRealizadas) * 100 : null,
        compromissos_recorrentes: recurringCommitments,
        percentual_renda_recorrencias: current.receitasRealizadas > 0 ? (recurringCommitments / current.receitasRealizadas) * 100 : null,
        faturas_abertas: openInvoiceValue,
        limite_cartoes: totalCardLimit,
        utilizacao_cartoes: totalCardLimit > 0 ? (openInvoiceValue / totalCardLimit) * 100 : null,
        reserva: reserveBalance,
        meses_cobertura: essentialAverage > 0 ? reserveBalance / essentialAverage : null,
      },
      desvios: deviations.slice(0, 8),
      insights: insights.slice(0, 3),
      pilares,
    };
  }

  async gerarFluxoContabil(usuario_id: string, inicioStr: string, fimStr: string, statusFilter: string = 'Pago', contaIdsFilter?: string[]) {
    // 1. Obter todas as contas do usuário (opcionalmente filtrada) e somar os seus saldos iniciais
    const contas = await prisma.contaBancaria.findMany({
      where: {
        usuario_id,
        ...(contaIdsFilter?.length ? { id: { in: contaIdsFilter } } : {})
      }
    });
    const saldoInicialAbstrato = contas.reduce((sum: number, c: any) => sum + Number(c.saldo_inicial), 0);

    const statusQuery = statusFilter === 'Ambos'
      ? { in: ['Pago', 'Pendente'] }
      : statusFilter === 'Pendente'
        ? 'Pendente'
        : 'Pago';

    // 2. Buscar todas as transações de Receita, Despesa e Transferencia de acordo com o status e conta opcional
    const transacoes = await prisma.transacao.findMany({
      where: {
        usuario_id,
        status: statusQuery,
        tipo: { in: ['Receita', 'Despesa', 'Transferencia'] },
        ...(contaIdsFilter?.length ? {
          OR: [
            { conta_id: { in: contaIdsFilter } },
            {
              conta: {
                cartao_detalhe: {
                  conta_pagamento_padrao_id: { in: contaIdsFilter }
                }
              }
            }
          ]
        } : {})
      } as any,
      include: {
        conta: {
          include: {
            cartao_detalhe: true
          }
        },
        fatura: {
          select: {
            data_vencimento: true
          }
        },
        subcategoria: {
          include: {
            categoria: true
          }
        }
      }
    }) as any[];

    const meses = getMonthsRange(inicioStr, fimStr);

    // Separar transações históricas (antes do período de início) e no período
    let saldoAcumulado = saldoInicialAbstrato;
    const transacoesNoPeriodo: any[] = [];

    for (const t of transacoes) {
      let mesStr = '';
      if (t.conta?.tipo === 'CartaoCredito' && t.conta.cartao_detalhe && !isInvoicePayment(t.descricao)) {
        mesStr = getCashFlowMonthForCardTransaction(
          t.data_transacao,
          t.conta.cartao_detalhe.dia_fechamento,
          t.conta.cartao_detalhe.dia_vencimento,
          t.fatura?.data_vencimento,
        );
      } else {
        mesStr = getNormalAccountMonthStr(t.data_transacao);
      }

      if (mesStr < inicioStr) {
        const val = Number(t.valor);
        if (t.tipo === 'Receita') {
          saldoAcumulado += val;
        } else if (t.tipo === 'Despesa') {
          saldoAcumulado -= val;
        } else if (t.tipo === 'Transferencia') {
          if (t.descricao.includes('[Saída]')) {
            saldoAcumulado -= val;
          } else {
            saldoAcumulado += val;
          }
        }
      } else if (mesStr >= inicioStr && mesStr <= fimStr) {
        transacoesNoPeriodo.push({ ...t, mesStr });
      }
    }

    // Estruturas auxiliares para agrupar categorias e subcategorias
    // Mapa: CategoriaNome -> { subcategorias: Map<SubcategoriaNome, { [mes: string]: number }>, valores: { [mes: string]: number } }
    const entradasCategorias = new Map<string, { subcategorias: Map<string, { [mes: string]: number }>; valores: { [mes: string]: number } }>();
    const saidasCategorias = new Map<string, { subcategorias: Map<string, { [mes: string]: number }>; valores: { [mes: string]: number } }>();

    const totalEntradasPorMes: { [mes: string]: number } = {};
    const totalSaidasPorMes: { [mes: string]: number } = {};
    const saldoMesPorMes: { [mes: string]: number } = {};
    const saldoAnteriorPorMes: { [mes: string]: number } = {};
    const saldoAcumuladoPorMes: { [mes: string]: number } = {};

    for (const m of meses) {
      totalEntradasPorMes[m] = 0;
      totalSaidasPorMes[m] = 0;
      saldoMesPorMes[m] = 0;
      saldoAnteriorPorMes[m] = 0;
      saldoAcumuladoPorMes[m] = 0;
    }

    // Processar transações do período
    for (const t of transacoesNoPeriodo) {
      const mStr = t.mesStr;
      const valor = Number(t.valor);
      
      let catNome = t.subcategoria?.categoria.nome ?? 'Sem Categoria';
      let subCatNome = t.subcategoria?.nome ?? 'Sem Subcategoria';
      
      let isEntrada = t.tipo === 'Receita';
      
      if (t.conta?.tipo === 'CartaoCredito' && t.tipo !== 'Transferencia') {
        catNome = `Fatura ${t.conta.nome}`;
      } else if (t.tipo === 'Transferencia') {
        catNome = 'Transferências';
        if (t.descricao.includes('[Saída]')) {
          isEntrada = false;
          subCatNome = 'Transferências Enviadas';
        } else {
          isEntrada = true;
          subCatNome = 'Transferências Recebidas';
        }
      }

      const mapParaUsar = isEntrada ? entradasCategorias : saidasCategorias;
      const totalMesMap = isEntrada ? totalEntradasPorMes : totalSaidasPorMes;

      totalMesMap[mStr] += valor;

      if (!mapParaUsar.has(catNome)) {
        mapParaUsar.set(catNome, {
          subcategorias: new Map<string, { [mes: string]: number }>(),
          valores: Object.fromEntries(meses.map(m => [m, 0]))
        });
      }

      const catObj = mapParaUsar.get(catNome)!;
      catObj.valores[mStr] += valor;

      if (!catObj.subcategorias.has(subCatNome)) {
        catObj.subcategorias.set(subCatNome, Object.fromEntries(meses.map(m => [m, 0])));
      }

      const subCatObj = catObj.subcategorias.get(subCatNome)!;
      subCatObj[mStr] += valor;
    }

    // Calcular saldos cronologicamente
    let runningBalance = saldoAcumulado;
    for (const m of meses) {
      saldoAnteriorPorMes[m] = runningBalance;
      const netChange = totalEntradasPorMes[m] - totalSaidasPorMes[m];
      saldoMesPorMes[m] = netChange;
      runningBalance += netChange;
      saldoAcumuladoPorMes[m] = runningBalance;
    }

    // Converter Mapas para Array JSON ordenado por nome de categoria
    const formatarCategorias = (map: typeof entradasCategorias) => {
      return Array.from(map.entries())
        .map(([categoria_nome, catData]) => ({
          categoria_nome,
          valores: catData.valores,
          subcategorias: Array.from(catData.subcategorias.entries())
            .map(([subcategoria_nome, valores]) => ({
              subcategoria_nome,
              valores
            }))
            .sort((a, b) => a.subcategoria_nome.localeCompare(b.subcategoria_nome))
        }))
        .sort((a, b) => a.categoria_nome.localeCompare(b.categoria_nome));
    };

    return {
      meses,
      entradas: formatarCategorias(entradasCategorias),
      total_entradas: totalEntradasPorMes,
      saidas: formatarCategorias(saidasCategorias),
      total_saidas: totalSaidasPorMes,
      saldo_mes: saldoMesPorMes,
      saldo_anterior: saldoAnteriorPorMes,
      saldo_acumulado: saldoAcumuladoPorMes
    };
  }
}
