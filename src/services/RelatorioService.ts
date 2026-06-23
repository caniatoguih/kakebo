import { OrcamentoRepository } from '../repositories/OrcamentoRepository';
import { TransacaoRepository } from '../repositories/TransacaoRepository';
import { PilarKakebo } from '../domain/enums/PilarKakebo';
import prisma from '../lib/prisma';

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

export class RelatorioService {
  private orcamentoRepo = new OrcamentoRepository();
  private transacaoRepo = new TransacaoRepository();

  async gerarPainelReflexao(usuario_id: string, mes: number, ano: number) {
    // 1. Buscar orçamentos do mês
    const orcamentos = await this.orcamentoRepo.findByMesAno(usuario_id, mes, ano);
    
    // 2. Buscar transações realizadas no mês
    const { transacoes } = await this.transacaoRepo.findByFilters({
      usuario_id,
      mes,
      ano,
      page: 1,
      limit: 10000 // Para relatório pegamos todas do mês
    });

    // 3. Estruturar os 4 pilares
    const pilares = {
      [PilarKakebo.SOBREVIVENCIA]: { orcado: 0, realizado: 0, saldo: 0, categorias: {} as any },
      [PilarKakebo.LAZER]: { orcado: 0, realizado: 0, saldo: 0, categorias: {} as any },
      [PilarKakebo.CULTURA]: { orcado: 0, realizado: 0, saldo: 0, categorias: {} as any },
      [PilarKakebo.EXTRAS]: { orcado: 0, realizado: 0, saldo: 0, categorias: {} as any },
    };

    // Preencher valores orçados
    orcamentos.forEach(orc => {
      const pilar = orc.subcategoria.categoria.pilar as PilarKakebo;
      const catNome = orc.subcategoria.categoria.nome;
      const subCatNome = orc.subcategoria.nome;
      const valor = Number(orc.valor_orcado);

      pilares[pilar].orcado += valor;
      
      if (!pilares[pilar].categorias[catNome]) {
        pilares[pilar].categorias[catNome] = { orcado: 0, realizado: 0, subcategorias: {} };
      }
      
      pilares[pilar].categorias[catNome].orcado += valor;
      pilares[pilar].categorias[catNome].subcategorias[subCatNome] = { orcado: valor, realizado: 0 };
    });

    // Preencher valores realizados (apenas despesas)
    transacoes.filter(t => t.tipo === 'Despesa' && t.subcategoria).forEach(t => {
      const pilar = t.subcategoria!.categoria.pilar as PilarKakebo;
      const catNome = t.subcategoria!.categoria.nome;
      const subCatNome = t.subcategoria!.nome;
      const valor = Number(t.valor);

      pilares[pilar].realizado += valor;

      if (pilares[pilar].categorias[catNome]) {
        pilares[pilar].categorias[catNome].realizado += valor;
        if (pilares[pilar].categorias[catNome].subcategorias[subCatNome]) {
          pilares[pilar].categorias[catNome].subcategorias[subCatNome].realizado += valor;
        }
      }
    });

    // Calcular saldos
    let totalOrcado = 0;
    let totalRealizado = 0;

    Object.values(pilares).forEach(pilar => {
      pilar.saldo = pilar.orcado - pilar.realizado;
      totalOrcado += pilar.orcado;
      totalRealizado += pilar.realizado;
    });

    return {
      mes,
      ano,
      resumo: {
        total_orcado: totalOrcado,
        total_realizado: totalRealizado,
        saldo_geral: totalOrcado - totalRealizado
      },
      pilares
    };
  }

  async gerarFluxoContabil(usuario_id: string, inicioStr: string, fimStr: string, statusFilter: string = 'Pago', contaIdFilter?: string) {
    // 1. Obter todas as contas do usuário (opcionalmente filtrada) e somar os seus saldos iniciais
    const contas = await prisma.contaBancaria.findMany({
      where: {
        usuario_id,
        ...(contaIdFilter ? { id: contaIdFilter } : {})
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
        ...(contaIdFilter ? {
          OR: [
            { conta_id: contaIdFilter },
            {
              conta: {
                cartao_detalhe: {
                  conta_pagamento_padrao_id: contaIdFilter
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
        mesStr = getPaymentMonthStr(t.data_transacao, t.conta.cartao_detalhe.dia_fechamento);
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
        subCatNome = `Fatura ${t.conta.nome}`;
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
