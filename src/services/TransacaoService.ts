import { TransacaoRepository } from '../repositories/TransacaoRepository';
import { Prisma } from '@prisma/client';
import { randomUUID as uuidv4 } from 'crypto';
import prisma from '../lib/prisma';
import { assertAccountOwnership, assertSubcategoryOwnership } from './OwnershipService';
import { calculateBalanceImpactCents } from '../domain/finance/balanceImpact';
import { distributeCents, fromCents, toCents } from '../domain/finance/money';
import { addMonthsClamped } from '../domain/finance/monthlyDate';
import { InvoiceService } from './InvoiceService';
import { getLastClosedBillingCycle, isLegacyInvoicePayment } from '../domain/billing/billingCycle';
import { recordFinancialAudit } from './AuditService';

function nativeDifferenceInDays(d1: Date, d2: Date): number {
  const diffTime = Math.abs(d1.getTime() - d2.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function isTypeCompatible(dbTipo: string, dbDescricao: string, ofxTipo: 'Despesa' | 'Receita'): boolean {
  if (dbTipo === ofxTipo) return true;
  
  if (dbTipo === 'Transferencia') {
    if (ofxTipo === 'Despesa') {
      return dbDescricao.includes('[Saída]');
    }
    if (ofxTipo === 'Receita') {
      return dbDescricao.includes('[Entrada]');
    }
  }
  
  return false;
}

export class TransacaoService {
  private transacaoRepo = new TransacaoRepository();
  private invoiceService = new InvoiceService();

  async criarTransacao(data: any, usuario_id: string) {
    const { total_parcelas, data_transacao, valor, recorrente, conta_destino_id, ...rest } = data;
    const conta = await assertAccountOwnership(rest.conta_id, usuario_id);
    await assertSubcategoryOwnership(rest.subcategoria_id, usuario_id);
    const cardDetails = conta.tipo === 'CartaoCredito'
      ? await prisma.cartaoCreditoDetalhe.findUnique({ where: { conta_id: conta.id } })
      : null;

    const totalCents = toCents(valor);
    const valorNumerico = fromCents(totalCents);
    const isRecorrente = !!recorrente;
    const totalParcelas = Number(total_parcelas ?? 1);
    const primeiraData = new Date(data_transacao);
    const anchorDay = primeiraData.getUTCDate();

    if (rest.tipo === 'Transferencia') {
      if (!conta_destino_id) throw new Error('Selecione a conta de destino.');
      if (conta_destino_id === conta.id) throw new Error('A conta de destino deve ser diferente da origem.');
      const contaDestino = await assertAccountOwnership(conta_destino_id, usuario_id);
      const descricaoBase = String(rest.descricao).replace(/^\[(?:Saída|Entrada)\]\s*/, '');
      const isTransferenciaRecorrente = isRecorrente && totalParcelas > 1;
      const quantidade = isTransferenciaRecorrente ? totalParcelas : 1;
      const transacao_pai_id = isTransferenciaRecorrente ? uuidv4() : null;

      return prisma.$transaction(async (tx) => {
        let primeiraSaidaId = '';
        let primeiraEntradaId = '';
        let primeiroGrupoId = '';
        for (let i = 1; i <= quantidade; i++) {
          const group = await tx.transferenciaGrupo.create({
            data: { usuario_id, descricao: descricaoBase },
          });
          const comum = {
            usuario_id,
            subcategoria_id: null,
            valor: valorNumerico,
            tipo: 'Transferencia' as const,
            data_transacao: addMonthsClamped(primeiraData, i - 1, anchorDay),
            status: i === 1 ? rest.status : 'Pendente' as const,
            total_parcelas: quantidade,
            parcela_atual: i,
            recorrente: isTransferenciaRecorrente,
            transacao_pai_id,
            transferencia_grupo_id: group.id,
          };
          const saida = await tx.transacao.create({
            data: { ...comum, conta_id: conta.id, descricao: `[Saída] ${descricaoBase}`, transferencia_direcao: 'Saida' },
          });
          const entrada = await tx.transacao.create({
            data: { ...comum, conta_id: contaDestino.id, descricao: `[Entrada] ${descricaoBase}`, transferencia_direcao: 'Entrada' },
          });
          if (i === 1) {
            primeiroGrupoId = group.id;
            primeiraSaidaId = saida.id;
            primeiraEntradaId = entrada.id;
          }
        }

        const impactoSaida = calculateBalanceImpactCents({
          accountType: conta.tipo, transactionType: 'Transferencia', status: rest.status,
          description: `[Saída] ${descricaoBase}`, value: valorNumerico,
        });
        const impactoEntrada = calculateBalanceImpactCents({
          accountType: contaDestino.tipo, transactionType: 'Transferencia', status: rest.status,
          description: `[Entrada] ${descricaoBase}`, value: valorNumerico,
        });
        if (impactoSaida !== 0) await tx.contaBancaria.update({
          where: { id: conta.id }, data: { saldo_atual: { increment: fromCents(impactoSaida) } },
        });
        if (impactoEntrada !== 0) await tx.contaBancaria.update({
          where: { id: contaDestino.id }, data: { saldo_atual: { increment: fromCents(impactoEntrada) } },
        });
        await recordFinancialAudit(tx, {
          usuarioId: usuario_id, action: isTransferenciaRecorrente ? 'CRIAR_TRANSFERENCIA_RECORRENTE' : 'CRIAR_TRANSFERENCIA',
          entity: isTransferenciaRecorrente ? 'Transacao' : 'TransferenciaGrupo', entityId: transacao_pai_id ?? primeiroGrupoId,
          data: { conta_origem_id: conta.id, conta_destino_id: contaDestino.id, transacao_saida_id: primeiraSaidaId, transacao_entrada_id: primeiraEntradaId, quantidade },
        });
        return isTransferenciaRecorrente
          ? { message: `${quantidade} transferências recorrentes criadas com sucesso.`, transacao_pai_id }
          : { message: 'Transferência registrada com sucesso.', transferencia_grupo_id: primeiroGrupoId };
      });
    }

    if (isRecorrente && totalParcelas > 1) {
      const transacoesRecorrentes: Prisma.TransacaoUncheckedCreateInput[] = [];
      const transacao_pai_id = uuidv4();

      for (let i = 1; i <= totalParcelas; i++) {
        transacoesRecorrentes.push({
          ...rest,
          usuario_id,
          valor: valorNumerico,
          data_transacao: addMonthsClamped(primeiraData, i - 1, anchorDay),
          parcela_atual: i,
          total_parcelas: totalParcelas,
          transacao_pai_id,
          recorrente: true,
          status: i === 1 ? rest.status : 'Pendente',
          id: uuidv4()
        });
      }

      const deltaCents = calculateBalanceImpactCents({
        accountType: conta.tipo, transactionType: rest.tipo, status: rest.status,
        description: rest.descricao, value: valorNumerico,
      });
      await prisma.$transaction(async (tx) => {
        if (cardDetails) await this.invoiceService.assignCardTransactions(
          tx, usuario_id, conta.id, cardDetails.dia_fechamento, cardDetails.dia_vencimento, transacoesRecorrentes,
        );
        await tx.transacao.createMany({ data: transacoesRecorrentes });
        if (deltaCents !== 0) await tx.contaBancaria.update({
          where: { id: conta.id }, data: { saldo_atual: { increment: fromCents(deltaCents) } },
        });
        await recordFinancialAudit(tx, {
          usuarioId: usuario_id, action: 'CRIAR_RECORRENCIA', entity: 'Transacao', entityId: transacao_pai_id,
          data: { quantidade: totalParcelas, conta_id: conta.id },
        });
      });

      return { message: `${totalParcelas} cobranças recorrentes criadas com sucesso.`, transacao_pai_id };
    }

    if (totalParcelas > 1) {
      const transacoesParceladas: Prisma.TransacaoUncheckedCreateInput[] = [];
      const transacao_pai_id = uuidv4();
      const parcelasCents = distributeCents(totalCents, totalParcelas);

      for (let i = 1; i <= totalParcelas; i++) {
        transacoesParceladas.push({
          ...rest,
          usuario_id,
          valor: fromCents(parcelasCents[i - 1]),
          data_transacao: addMonthsClamped(primeiraData, i - 1, anchorDay),
          parcela_atual: i,
          total_parcelas: totalParcelas,
          transacao_pai_id,
          recorrente: false,
          id: uuidv4()
        });
      }

      const deltaCents = calculateBalanceImpactCents({
        accountType: conta.tipo, transactionType: rest.tipo, status: rest.status,
        description: rest.descricao, value: valorNumerico,
      });
      await prisma.$transaction(async (tx) => {
        if (cardDetails) await this.invoiceService.assignCardTransactions(
          tx, usuario_id, conta.id, cardDetails.dia_fechamento, cardDetails.dia_vencimento, transacoesParceladas,
        );
        await tx.transacao.createMany({ data: transacoesParceladas });
        if (deltaCents !== 0) await tx.contaBancaria.update({
          where: { id: conta.id }, data: { saldo_atual: { increment: fromCents(deltaCents) } },
        });
        await recordFinancialAudit(tx, {
          usuarioId: usuario_id, action: 'CRIAR_PARCELAMENTO', entity: 'Transacao', entityId: transacao_pai_id,
          data: { quantidade: totalParcelas, conta_id: conta.id },
        });
      });

      return { message: `${totalParcelas} parcelas criadas com sucesso.`, transacao_pai_id };
    }

    return prisma.$transaction(async (tx) => {
      const input: Prisma.TransacaoUncheckedCreateInput = {
        ...rest, usuario_id, valor: valorNumerico, data_transacao: primeiraData,
        total_parcelas: 1, parcela_atual: 1, recorrente: isRecorrente,
      };
      if (cardDetails) await this.invoiceService.assignCardTransactions(
        tx, usuario_id, conta.id, cardDetails.dia_fechamento, cardDetails.dia_vencimento, [input],
      );
      const transacao = await tx.transacao.create({ data: input });
      const deltaCents = calculateBalanceImpactCents({
        accountType: conta.tipo, transactionType: rest.tipo, status: rest.status,
        description: rest.descricao, value: valorNumerico,
      });
      if (deltaCents !== 0) await tx.contaBancaria.update({
        where: { id: conta.id }, data: { saldo_atual: { increment: fromCents(deltaCents) } },
      });
      await recordFinancialAudit(tx, {
        usuarioId: usuario_id, action: 'CRIAR', entity: 'Transacao', entityId: transacao.id,
        data: { conta_id: conta.id, tipo: rest.tipo, status: rest.status },
      });
      return transacao;
    });
  }

  async listarTransacoes(filtros: any) {
    return this.transacaoRepo.findByFilters({
      usuario_id: filtros.usuario_id,
      mes: filtros.mes ? parseInt(filtros.mes) : undefined,
      ano: filtros.ano ? parseInt(filtros.ano) : undefined,
      conta_id: filtros.conta_id,
      subcategoria_id: filtros.subcategoria_id,
      busca: filtros.busca,
      status: filtros.status,
      inicio: filtros.inicio,
      fim: filtros.fim,
      page: filtros.page ? parseInt(filtros.page) : 1,
      limit: filtros.limit ? parseInt(filtros.limit) : 25
    });
  }

  async fecharFatura(usuario_id: string, conta_id: string) {
    const contaCartao = await prisma.contaBancaria.findFirst({
      where: { id: conta_id, usuario_id, tipo: 'CartaoCredito' },
      include: { cartao_detalhe: true }
    });
    if (!contaCartao) throw new Error('Cartão de crédito não encontrado.');
    if (contaCartao.cartao_detalhe?.conta_pagamento_padrao_id) {
      await assertAccountOwnership(contaCartao.cartao_detalhe.conta_pagamento_padrao_id, usuario_id);
    }

    // Busca transações pendentes e atualiza para Pago
    const pendentes = await this.transacaoRepo.findPendentesByConta(usuario_id, conta_id);
    
    if (pendentes.length === 0) {
      return { message: "Nenhuma transação pendente para fechar." };
    }

    // Calcula o total da fatura a ser paga
    let totalFaturaCents = 0;
    for (const t of pendentes) {
      totalFaturaCents += calculateBalanceImpactCents({
        accountType: 'CartaoCredito', transactionType: t.tipo, status: t.status,
        description: t.descricao, value: t.valor,
      });
    }
    const totalFatura = fromCents(totalFaturaCents);

    await prisma.$transaction(async (tx) => {
      // 1. Marca todas como pagas
      for (const transacao of pendentes) {
        await tx.transacao.update({
          where: { id: transacao.id },
          data: { status: 'Pago' }
        });
      }

      // 2. Zera a fatura do cartão
      await tx.contaBancaria.update({
        where: { id: conta_id },
        data: { saldo_atual: 0 }
      });

      if ((contaCartao?.cartao_detalhe as any)?.conta_pagamento_padrao_id && totalFatura > 0) {
        const contaPagamentoId = (contaCartao?.cartao_detalhe as any).conta_pagamento_padrao_id;
        const group = await tx.transferenciaGrupo.create({
          data: { usuario_id, descricao: `Pagamento da fatura ${contaCartao.nome}` },
        });

        // Outbound (Saída) da conta corrente
        await tx.transacao.create({
          data: {
            usuario_id,
            conta_id: contaPagamentoId,
            subcategoria_id: null,
            descricao: `[Saída] Pagamento Fatura ${contaCartao?.nome || 'Cartão'}`,
            valor: totalFatura,
            tipo: 'Transferencia',
            data_transacao: new Date(),
            status: 'Pago',
            id: uuidv4(),
            transferencia_grupo_id: group.id,
            transferencia_direcao: 'Saida',
          }
        });

        // Inbound (Entrada) no cartão de crédito
        await tx.transacao.create({
          data: {
            usuario_id,
            conta_id: conta_id,
            subcategoria_id: null,
            descricao: `[Entrada] Pagamento Fatura ${contaCartao?.nome || 'Cartão'}`,
            valor: totalFatura,
            tipo: 'Transferencia',
            data_transacao: new Date(),
            status: 'Pago',
            id: uuidv4(),
            transferencia_grupo_id: group.id,
            transferencia_direcao: 'Entrada',
          }
        });

        // Decrementa o saldo da conta corrente
        await tx.contaBancaria.update({
          where: { id: contaPagamentoId },
          data: { saldo_atual: { decrement: totalFatura } }
        });
      }
      await recordFinancialAudit(tx, {
        usuarioId: usuario_id, action: 'FECHAR_FATURA_LEGADO', entity: 'ContaBancaria', entityId: conta_id,
        data: { transacoes: pendentes.length },
      });
    });

    return { message: `Fatura fechada. ${pendentes.length} transações marcadas como pagas.` };
  }

  async pagarFatura(usuarioId: string, input: {
    cartao_id: string;
    conta_origem_id: string;
    fatura_id?: string;
    valor: number;
    data_pagamento: string;
  }) {
    const cartao = await prisma.contaBancaria.findFirst({
      where: { id: input.cartao_id, usuario_id: usuarioId, tipo: 'CartaoCredito' },
      include: { cartao_detalhe: true },
    });
    if (!cartao?.cartao_detalhe) throw new Error('Cartão de crédito não encontrado.');
    const contaOrigem = await assertAccountOwnership(input.conta_origem_id, usuarioId);
    if (contaOrigem.tipo === 'CartaoCredito' || contaOrigem.id === cartao.id) {
      throw new Error('A conta de origem do pagamento deve ser uma conta bancária comum.');
    }

    const paymentDate = new Date(input.data_pagamento);
    const paymentCents = toCents(input.valor);

    return prisma.$transaction(async (tx) => {
      let invoice = input.fatura_id
        ? await tx.faturaCartao.findFirst({ where: { id: input.fatura_id, usuario_id: usuarioId, cartao_id: cartao.id } })
        : await tx.faturaCartao.findFirst({
            where: {
              usuario_id: usuarioId,
              cartao_id: cartao.id,
              data_fechamento: { lte: paymentDate },
              status: { in: ['Fechada', 'ParcialmentePaga', 'Vencida'] },
            },
            orderBy: { data_fechamento: 'desc' },
          });

      if (!invoice) {
        const cycle = getLastClosedBillingCycle(
          paymentDate,
          cartao.cartao_detalhe!.dia_fechamento,
          cartao.cartao_detalhe!.dia_vencimento,
        );
        const historical = await tx.transacao.findMany({
          where: { conta_id: cartao.id, data_transacao: { gte: cycle.start, lte: cycle.end } },
        });
        const purchases = historical.filter((transaction) => !isLegacyInvoicePayment(transaction.descricao));
        const totalCents = purchases.reduce((sum, transaction) => sum + calculateBalanceImpactCents({
          accountType: 'CartaoCredito', transactionType: transaction.tipo, status: transaction.status,
          description: transaction.descricao, value: transaction.valor,
        }), 0);
        invoice = await tx.faturaCartao.upsert({
          where: { cartao_id_competencia: { cartao_id: cartao.id, competencia: cycle.competence } },
          update: { total: fromCents(totalCents), status: 'Fechada' },
          create: {
            usuario_id: usuarioId, cartao_id: cartao.id, competencia: cycle.competence,
            data_inicio: cycle.start, data_fim: cycle.end, data_fechamento: cycle.closingDate,
            data_vencimento: cycle.dueDate, total: fromCents(totalCents), status: 'Fechada',
          },
        });
        if (purchases.length > 0) await tx.transacao.updateMany({
          where: { id: { in: purchases.map((transaction) => transaction.id) } }, data: { fatura_id: invoice.id },
        });
      }

      const outstandingCents = toCents(invoice.total) - toCents(invoice.total_pago);
      if (outstandingCents <= 0) throw new Error('Esta fatura já está paga.');
      if (paymentCents > outstandingCents) throw new Error('O pagamento não pode ser maior que o saldo da fatura.');

      const group = await tx.transferenciaGrupo.create({
        data: { usuario_id: usuarioId, descricao: `Pagamento da fatura ${invoice.competencia}` },
      });
      const outgoingId = uuidv4();
      const incomingId = uuidv4();
      const value = fromCents(paymentCents);
      const baseDescription = `Liquidação Fatura ${cartao.nome} — ${invoice.competencia}`;

      await tx.transacao.createMany({ data: [
        {
          id: outgoingId, usuario_id: usuarioId, conta_id: contaOrigem.id, descricao: `[Saída] ${baseDescription}`,
          valor: value, tipo: 'Transferencia', data_transacao: paymentDate, status: 'Pago',
          transferencia_grupo_id: group.id, transferencia_direcao: 'Saida',
        },
        {
          id: incomingId, usuario_id: usuarioId, conta_id: cartao.id, descricao: `[Entrada] ${baseDescription}`,
          valor: value, tipo: 'Transferencia', data_transacao: paymentDate, status: 'Pago',
          transferencia_grupo_id: group.id, transferencia_direcao: 'Entrada',
        },
      ] });
      await tx.pagamentoFatura.create({ data: {
        usuario_id: usuarioId, fatura_id: invoice.id, valor: value, data_pagamento: paymentDate,
        transacao_saida_id: outgoingId, transacao_entrada_id: incomingId,
      } });
      await tx.faturaCartao.update({
        where: { id: invoice.id }, data: { total_pago: { increment: value } },
      });
      await tx.contaBancaria.update({
        where: { id: contaOrigem.id }, data: { saldo_atual: { decrement: value } },
      });
      await tx.contaBancaria.update({
        where: { id: cartao.id }, data: { saldo_atual: { decrement: value } },
      });
      await this.invoiceService.refreshStatus(tx, invoice.id);
      await recordFinancialAudit(tx, {
        usuarioId, action: 'PAGAR_FATURA', entity: 'FaturaCartao', entityId: invoice.id,
        data: { conta_origem_id: contaOrigem.id, transferencia_grupo_id: group.id, pagamento_centavos: paymentCents },
      });

      return {
        message: paymentCents === outstandingCents ? 'Fatura paga com sucesso.' : 'Pagamento parcial registrado com sucesso.',
        fatura_id: invoice.id,
        saldo_restante: fromCents(outstandingCents - paymentCents),
      };
    });
  }

  async toggleStatus(id: string, usuario_id: string) {
    const transacao = await prisma.transacao.findFirst({
      where: { id, usuario_id }, include: { conta: true },
    });
    if (!transacao || transacao.usuario_id !== usuario_id) {
      throw new Error("Transação não encontrada.");
    }

    const novoStatus = transacao.status === 'Pago' ? 'Pendente' : 'Pago';
    const oldImpact = calculateBalanceImpactCents({
      accountType: transacao.conta.tipo, transactionType: transacao.tipo,
      status: transacao.status, description: transacao.descricao, value: transacao.valor,
      recurring: transacao.recorrente, installmentNumber: transacao.parcela_atual,
    });
    const newImpact = calculateBalanceImpactCents({
      accountType: transacao.conta.tipo, transactionType: transacao.tipo,
      status: novoStatus, description: transacao.descricao, value: transacao.valor,
      recurring: transacao.recorrente, installmentNumber: transacao.parcela_atual,
    });
    const deltaCents = newImpact - oldImpact;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.transacao.update({ where: { id }, data: { status: novoStatus } });
      if (deltaCents !== 0) await tx.contaBancaria.update({
        where: { id: transacao.conta_id }, data: { saldo_atual: { increment: fromCents(deltaCents) } },
      });
      await recordFinancialAudit(tx, {
        usuarioId: usuario_id, action: 'ALTERAR_STATUS', entity: 'Transacao', entityId: id,
        data: { status_anterior: transacao.status, status_novo: novoStatus },
      });
      return updated;
    });
  }

  async importarTransacoes(usuario_id: string, conta_id: string, transacoesData: any[]) {
    // 1. Busca a conta bancária de origem
    const contaOrigem = await prisma.contaBancaria.findUnique({
      where: { id: conta_id }
    });

    if (!contaOrigem || contaOrigem.usuario_id !== usuario_id) {
      throw new Error("Conta bancária de origem não encontrada.");
    }

    const subcategoriasIds = [...new Set(transacoesData.map((t) => t.subcategoria_id).filter(Boolean))] as string[];
    for (const subcategoriaId of subcategoriasIds) {
      await assertSubcategoryOwnership(subcategoriaId, usuario_id);
    }

    // 2. Processa as transações
    const transacoesParaCriar: Prisma.TransacaoUncheckedCreateInput[] = [];
    const gruposTransferencia: Prisma.TransferenciaGrupoUncheckedCreateInput[] = [];
    
    // Mapeamento de deltas em centavos por conta_id
    const saldosDeltas: Record<string, number> = {
      [conta_id]: 0
    };

    for (const t of transacoesData) {
      let valorCents: number;
      try {
        valorCents = toCents(t.valor);
      } catch {
        continue;
      }
      if (valorCents <= 0) continue;
      const valor = fromCents(valorCents);

      const subcategoria_id = t.subcategoria_id || null;
      const status = t.status || 'Pago';
      const tipo = t.tipo || 'Despesa';

      if (tipo === 'Transferencia' && t.conta_destino_id) {
        const conta_destino_id = t.conta_destino_id;
        const transferenciaGrupoId = uuidv4();
        
        if (conta_destino_id === conta_id) {
          throw new Error("A conta de destino de uma transferência não pode ser igual à conta de origem.");
        }

        // Busca a conta de destino para validar e identificar tipo
        const contaDestino = await prisma.contaBancaria.findUnique({
          where: { id: conta_destino_id }
        });
        if (!contaDestino || contaDestino.usuario_id !== usuario_id) {
          throw new Error("Conta bancária de destino não encontrada.");
        }
        gruposTransferencia.push({
          id: transferenciaGrupoId,
          usuario_id,
          descricao: t.descricao || 'Transferência entre contas',
        });

        // 1. Transação de saída (origem)
        transacoesParaCriar.push({
          usuario_id,
          conta_id,
          subcategoria_id: null,
          descricao: `[Saída] ${t.descricao || 'Transferência entre contas'}`,
          valor,
          tipo: 'Transferencia',
          data_transacao: new Date(t.data_transacao),
          status: 'Pago',
          parcela_atual: 1,
          total_parcelas: 1,
          transferencia_grupo_id: transferenciaGrupoId,
          transferencia_direcao: 'Saida'
        });

        // 2. Transação de entrada (destino)
        transacoesParaCriar.push({
          usuario_id,
          conta_id: conta_destino_id,
          subcategoria_id: null,
          descricao: `[Entrada] ${t.descricao || 'Transferência entre contas'}`,
          valor,
          tipo: 'Transferencia',
          data_transacao: new Date(t.data_transacao),
          status: 'Pago',
          parcela_atual: 1,
          total_parcelas: 1,
          transferencia_grupo_id: transferenciaGrupoId,
          transferencia_direcao: 'Entrada'
        });

        saldosDeltas[conta_id] += calculateBalanceImpactCents({
          accountType: contaOrigem.tipo, transactionType: 'Transferencia', status: 'Pago',
          description: `[Saída] ${t.descricao || 'Transferência entre contas'}`, value: valor,
        });

        // 4. Impacto de entrada na conta de destino
        if (!saldosDeltas[conta_destino_id]) {
          saldosDeltas[conta_destino_id] = 0;
        }

        saldosDeltas[conta_destino_id] += calculateBalanceImpactCents({
          accountType: contaDestino.tipo, transactionType: 'Transferencia', status: 'Pago',
          description: `[Entrada] ${t.descricao || 'Transferência entre contas'}`, value: valor,
        });

      } else {
        // Lançamento comum (Despesa / Receita)
        transacoesParaCriar.push({
          usuario_id,
          conta_id,
          subcategoria_id,
          descricao: t.descricao || 'Transação Importada',
          valor,
          tipo,
          data_transacao: new Date(t.data_transacao),
          status,
          parcela_atual: 1,
          total_parcelas: 1
        });

        saldosDeltas[conta_id] += calculateBalanceImpactCents({
          accountType: contaOrigem.tipo, transactionType: tipo, status,
          description: t.descricao, value: valor,
        });
      }
    }

    if (transacoesParaCriar.length === 0) {
      throw new Error("Nenhuma transação válida para importar.");
    }

    // 3. Executa a criação e atualização em lote (transação atômica)
    const count = await prisma.$transaction(async (tx) => {
      if (gruposTransferencia.length > 0) {
        await tx.transferenciaGrupo.createMany({ data: gruposTransferencia });
      }
      // Cria transações
      const createRes = await tx.transacao.createMany({
        data: transacoesParaCriar
      });

      // Atualiza saldos das contas envolvidas
      for (const [cId, deltaCents] of Object.entries(saldosDeltas)) {
        if (deltaCents === 0) continue;
        await tx.contaBancaria.update({
          where: { id: cId },
          data: { saldo_atual: { increment: fromCents(deltaCents) } }
        });
      }
      await recordFinancialAudit(tx, {
        usuarioId: usuario_id, action: 'IMPORTAR', entity: 'ContaBancaria', entityId: conta_id,
        data: { quantidade: createRes.count },
      });

      return createRes.count;
    });

    return { message: `${count} transações importadas com sucesso.`, count };
  }

  parseOFX(ofxText: string): Array<{ tipo: 'Receita' | 'Despesa'; valor: number; data: Date; descricao: string; fitid: string }> {
    const transactions: Array<{ tipo: 'Receita' | 'Despesa'; valor: number; data: Date; descricao: string; fitid: string }> = [];
    
    // Split by <STMTTRN> tag (case-insensitive)
    const blocks = ofxText.split(/<STMTTRN>/i).slice(1);
    
    for (const block of blocks) {
      const typeMatch = block.match(/<TRNTYPE>\s*(CREDIT|DEBIT)/i);
      const amtMatch = block.match(/<TRNAMT>\s*([-\d.]+)/i);
      const memoMatch = block.match(/<MEMO>\s*([^\r\n<]+)/i);
      const dateMatch = block.match(/<DTPOSTED>\s*(\d{8})/i);
      const fitidMatch = block.match(/<FITID>\s*([^\r\n<]+)/i);

      if (amtMatch) {
        const rawAmt = parseFloat(amtMatch[1]);
        const valor = Math.abs(rawAmt);
        const tipo = rawAmt < 0 ? 'Despesa' : 'Receita';
        
        let descricao = 'Transação OFX';
        if (memoMatch) {
          descricao = memoMatch[1].trim();
        }

        let data = new Date();
        if (dateMatch) {
          const dStr = dateMatch[1]; // YYYYMMDD
          const year = parseInt(dStr.slice(0, 4));
          const month = parseInt(dStr.slice(4, 6)) - 1;
          const day = parseInt(dStr.slice(6, 8));
          data = new Date(year, month, day);
        }

        const fitid = fitidMatch ? fitidMatch[1].trim() : '';

        transactions.push({ tipo, valor, data, descricao, fitid });
      }
    }

    return transactions;
  }

  async conciliarOFX(usuario_id: string, conta_id: string, ofxText: string) {
    // 1. Busca a conta bancária
    const conta = await prisma.contaBancaria.findUnique({
      where: { id: conta_id }
    });

    if (!conta || conta.usuario_id !== usuario_id) {
      throw new Error("Conta bancária não encontrada.");
    }

    // 2. Parse do OFX
    const transacoesOFX = this.parseOFX(ofxText);

    // 3. Busca todas as transações desta conta
    const todas = await prisma.transacao.findMany({
      where: {
        usuario_id,
        conta_id
      },
      orderBy: { data_transacao: 'asc' }
    });

    const conciliadas: Array<{ ofx: any; transacao: any; alreadyPaid?: boolean }> = [];
    const naoEncontradas: Array<any> = [];

    // Conjunto de IDs de transações já combinadas para evitar match duplo
    const matchedIds = new Set<string>();

    let saldoDeltaCents = 0;

    for (const ofxTr of transacoesOFX) {
      const ofxDate = new Date(ofxTr.data);

      // A. Procura primeiro uma transação PENDENTE que bata o valor, tipo e proximidade de data (±5 dias)
      const pendingMatch = todas.find(p => 
        p.status === 'Pendente' &&
        !matchedIds.has(p.id) &&
        Number(p.valor) === ofxTr.valor &&
        isTypeCompatible(p.tipo, p.descricao, ofxTr.tipo) &&
        Math.abs(nativeDifferenceInDays(new Date(p.data_transacao), ofxDate)) <= 5
      );

      if (pendingMatch) {
        matchedIds.add(pendingMatch.id);
        conciliadas.push({
          ofx: ofxTr,
          transacao: pendingMatch,
          alreadyPaid: false
        });

        // Calcula impacto no saldo
        if (conta.tipo !== 'CartaoCredito') {
          if (ofxTr.tipo === 'Despesa') {
            saldoDeltaCents -= toCents(ofxTr.valor);
          } else if (ofxTr.tipo === 'Receita') {
            saldoDeltaCents += toCents(ofxTr.valor);
          }
        }
      } else {
        // B. Se não achou Pendente, procura por uma transação PAGO que já foi lançada
        // com o mesmo valor, tipo e proximidade de data (±3 dias)
        const paidMatch = todas.find(p => 
          p.status === 'Pago' &&
          !matchedIds.has(p.id) &&
          Number(p.valor) === ofxTr.valor &&
          isTypeCompatible(p.tipo, p.descricao, ofxTr.tipo) &&
          Math.abs(nativeDifferenceInDays(new Date(p.data_transacao), ofxDate)) <= 3
        );

        if (paidMatch) {
          matchedIds.add(paidMatch.id);
          conciliadas.push({
            ofx: ofxTr,
            transacao: paidMatch,
            alreadyPaid: true // Marca que já estava pago (já lançado)
          });
        } else {
          naoEncontradas.push(ofxTr);
        }
      }
    }

    // 4. Executa a conciliação atômica no banco de dados para os itens que eram pendentes
    const toUpdate = conciliadas.filter(c => !c.alreadyPaid);
    if (toUpdate.length > 0) {
      await prisma.$transaction(async (tx) => {
        // Marca as transações encontradas como Pago
        const idsToUpdate = toUpdate.map(c => c.transacao.id);
        await tx.transacao.updateMany({
          where: {
            id: { in: idsToUpdate }
          },
          data: {
            status: 'Pago'
          }
        });

        // Atualiza o saldo da conta
        if (saldoDeltaCents !== 0) {
          await tx.contaBancaria.update({
            where: { id: conta_id },
            data: { saldo_atual: { increment: fromCents(saldoDeltaCents) } }
          });
        }
      });
    }

    return {
      message: `${conciliadas.length} transações conciliadas com sucesso.`,
      conciliadasCount: conciliadas.length,
      naoEncontradasCount: naoEncontradas.length,
      conciliadas,
      naoEncontradas
    };
  }

  async converterParaTransferencia(
    usuario_id: string,
    conta_origem_id: string,
    receita_id: string,
    descricao: string,
    data_transacao: Date,
    valor: number
  ) {
    valor = fromCents(toCents(valor));
    const receitaExistente = await prisma.transacao.findUnique({
      where: { id: receita_id },
      include: { conta: true }
    });

    if (!receitaExistente || receitaExistente.usuario_id !== usuario_id) {
      throw new Error("Transação de receita não encontrada.");
    }
    if (receitaExistente.tipo !== 'Receita') {
      throw new Error("A transação selecionada deve ser do tipo Receita.");
    }
    if (receitaExistente.conta_id === conta_origem_id) {
      throw new Error("A conta de destino não pode ser igual à conta de origem.");
    }

    const contaOrigem = await prisma.contaBancaria.findUnique({
      where: { id: conta_origem_id }
    });
    const contaDestino = receitaExistente.conta;

    if (!contaOrigem || contaOrigem.usuario_id !== usuario_id) {
      throw new Error("Conta bancária de origem não encontrada.");
    }

    return prisma.$transaction(async (tx) => {
      const group = await tx.transferenciaGrupo.create({
        data: { usuario_id, descricao },
      });
      const transacaoDestino = await tx.transacao.update({
        where: { id: receita_id },
        data: {
          tipo: 'Transferencia',
          descricao: `[Entrada] ${descricao}`,
          subcategoria_id: null,
          status: 'Pago',
          transferencia_grupo_id: group.id,
          transferencia_direcao: 'Entrada',
        }
      });

      const transacaoOrigem = await tx.transacao.create({
        data: {
          usuario_id,
          conta_id: conta_origem_id,
          subcategoria_id: null,
          descricao: `[Saída] ${descricao}`,
          valor,
          tipo: 'Transferencia',
          data_transacao,
          status: 'Pago',
          transferencia_grupo_id: group.id,
          transferencia_direcao: 'Saida',
        }
      });

      if (contaOrigem.tipo === 'CartaoCredito') {
        await tx.contaBancaria.update({
          where: { id: conta_origem_id },
          data: { saldo_atual: { increment: valor } }
        });
      } else {
        await tx.contaBancaria.update({
          where: { id: conta_origem_id },
          data: { saldo_atual: { decrement: valor } }
        });
      }

      if (receitaExistente.status === 'Pendente') {
        if (contaDestino.tipo === 'CartaoCredito') {
          await tx.contaBancaria.update({
            where: { id: contaDestino.id },
            data: { saldo_atual: { decrement: valor } }
          });
        } else {
          await tx.contaBancaria.update({
            where: { id: contaDestino.id },
            data: { saldo_atual: { increment: valor } }
          });
        }
      }

      await recordFinancialAudit(tx, {
        usuarioId: usuario_id, action: 'CONVERTER_TRANSFERENCIA', entity: 'TransferenciaGrupo', entityId: group.id,
        data: { transacao_origem_id: transacaoOrigem.id, transacao_destino_id: transacaoDestino.id },
      });

      return { transacaoOrigem, transacaoDestino };
    });
  }

  async conciliarOFXBatch(usuario_id: string, statements: Array<{ conta_id: string; ofxText: string }>) {
    const contasIds = statements.map(s => s.conta_id);
    
    // 1. Valida e busca as contas envolvidas
    const dbContas = await prisma.contaBancaria.findMany({
      where: {
        id: { in: contasIds },
        usuario_id
      }
    });

    if (dbContas.length !== new Set(contasIds).size) {
      throw new Error("Uma ou mais contas bancárias não foram encontradas ou não pertencem ao usuário.");
    }

    const contasMap = new Map(dbContas.map(c => [c.id, c.nome]));

    const allConciliadas: Array<any> = [];
    const allUnmatched: Array<{
      conta_id: string;
      conta_nome: string;
      tipo: 'Receita' | 'Despesa';
      valor: number;
      data: Date;
      descricao: string;
      fitid: string;
    }> = [];

    // 2. Executa a conciliação individual de cada extrato
    for (const statement of statements) {
      const contaNome = contasMap.get(statement.conta_id) || "Conta";
      const result = await this.conciliarOFX(usuario_id, statement.conta_id, statement.ofxText);
      
      allConciliadas.push(...result.conciliadas);
      
      const mappedUnmatched = result.naoEncontradas.map((item: any) => ({
        conta_id: statement.conta_id,
        conta_nome: contaNome,
        tipo: item.tipo,
        valor: item.valor,
        data: new Date(item.data),
        descricao: item.descricao,
        fitid: item.fitid
      }));

      allUnmatched.push(...mappedUnmatched);
    }

    // 3. Algoritmo de Casamento de Transferências
    const suggestedTransfers: Array<any> = [];
    const matchedIndices = new Set<number>();

    for (let i = 0; i < allUnmatched.length; i++) {
      if (matchedIndices.has(i)) continue;
      const t1 = allUnmatched[i];

      // Só iniciamos a busca de transferência a partir de um débito (Despesa) para evitar duplicados
      if (t1.tipo !== 'Despesa') continue;

      let matchIdx = -1;
      for (let j = 0; j < allUnmatched.length; j++) {
        if (i === j || matchedIndices.has(j)) continue;
        const t2 = allUnmatched[j];

        // Regras de correspondência de transferência:
        // A. Tipo diferente (Receita/Entrada)
        // B. Contas diferentes
        // C. Valor idêntico
        // D. Lançados necessariamente no mesmo dia
        if (
          t2.tipo === 'Receita' &&
          t2.conta_id !== t1.conta_id &&
          t2.valor === t1.valor &&
          t1.data.getFullYear() === t2.data.getFullYear() &&
          t1.data.getMonth() === t2.data.getMonth() &&
          t1.data.getDate() === t2.data.getDate()
        ) {
          matchIdx = j;
          break;
        }
      }

      if (matchIdx !== -1) {
        matchedIndices.add(i);
        matchedIndices.add(matchIdx);
        const t2 = allUnmatched[matchIdx];

        suggestedTransfers.push({
          id: `${t1.fitid || uuidv4()}-${t2.fitid || uuidv4()}`,
          origem: t1,
          destino: t2,
          valor: t1.valor,
          data: t1.data,
          descricao: `Transferência de ${t1.conta_nome} para ${t2.conta_nome}`
        });
      }
    }

    // 4. Filtra transações que restaram órfãs (sem casamento)
    const remainingUnmatched = allUnmatched.filter((_, idx) => !matchedIndices.has(idx));

    return {
      message: `${allConciliadas.length} transações conciliadas automaticamente em lote.`,
      conciliadasCount: allConciliadas.length,
      naoEncontradasCount: remainingUnmatched.length,
      suggestedTransfersCount: suggestedTransfers.length,
      conciliadas: allConciliadas,
      naoEncontradas: remainingUnmatched,
      suggestedTransfers
    };
  }

  async editarTransacao(id: string, data: any, usuario_id: string) {
    const transacaoExistente = await prisma.transacao.findUnique({
      where: { id },
      include: {
        conta: true,
        pagamento_fatura_saida: true,
        pagamento_fatura_entrada: true,
      }
    });

    if (!transacaoExistente || transacaoExistente.usuario_id !== usuario_id) {
      throw new Error("Transação não encontrada.");
    }

    const { conta_id, conta_destino_id, subcategoria_id, descricao, valor, tipo, data_transacao, status } = data;
    await assertSubcategoryOwnership(subcategoria_id, usuario_id);

    // Busca a nova conta
    const novaConta = await prisma.contaBancaria.findUnique({
      where: { id: conta_id }
    });

    if (!novaConta || novaConta.usuario_id !== usuario_id) {
      throw new Error("Conta bancária de destino não encontrada.");
    }

    const valorNumerico = fromCents(toCents(valor));

    // Identifica se tem uma transação gêmea (outro lado da transferência)
    let twinTransacao: any = null;

    if (transacaoExistente.tipo === 'Transferencia') {
      if (transacaoExistente.transferencia_grupo_id) {
        twinTransacao = await prisma.transacao.findFirst({
          where: {
            usuario_id,
            transferencia_grupo_id: transacaoExistente.transferencia_grupo_id,
            id: { not: id },
          },
          include: { conta: true },
        });
      }
      const isEntrada = transacaoExistente.descricao.startsWith('[Entrada]');
      const isSaida = transacaoExistente.descricao.startsWith('[Saída]');
      
      if (!twinTransacao && (isEntrada || isSaida)) {
        const baseDesc = transacaoExistente.descricao.slice(9);
        const oppositePrefix = isEntrada ? '[Saída]' : '[Entrada]';
        
        twinTransacao = await prisma.transacao.findFirst({
          where: {
            usuario_id,
            tipo: 'Transferencia',
            descricao: {
              startsWith: oppositePrefix
            },
            data_transacao: transacaoExistente.data_transacao,
            valor: transacaoExistente.valor,
            id: { not: id }
          },
          include: { conta: true }
        });
        
        if (twinTransacao && twinTransacao.descricao.slice(9) !== baseDesc) {
          twinTransacao = null;
        }
      }
    }

    const novaContaDestino = transacaoExistente.tipo === 'Transferencia' && tipo === 'Transferencia' && twinTransacao
      ? await assertAccountOwnership(conta_destino_id, usuario_id)
      : null;
    if (novaContaDestino?.id === novaConta.id) {
      throw new Error('A conta de destino deve ser diferente da origem.');
    }

    return prisma.$transaction(async (tx) => {
      if (transacaoExistente.tipo === 'Transferencia' && tipo === 'Transferencia' && twinTransacao && novaContaDestino) {
        const oldItems = [transacaoExistente, twinTransacao];
        for (const item of oldItems) {
          const oldImpact = calculateBalanceImpactCents({
            accountType: item.conta.tipo, transactionType: 'Transferencia', status: item.status,
            description: item.descricao, value: item.valor,
          });
          if (oldImpact !== 0) await tx.contaBancaria.update({
            where: { id: item.conta_id }, data: { saldo_atual: { increment: fromCents(-oldImpact) } },
          });
        }

        const baseDesc = String(descricao).replace(/^\[(?:Saída|Entrada)\]\s*/, '');
        const saidaExistente = oldItems.find((item) => item.transferencia_direcao === 'Saida' || item.descricao.startsWith('[Saída]'))!;
        const entradaExistente = oldItems.find((item) => item.id !== saidaExistente.id)!;
        const saida = await tx.transacao.update({
          where: { id: saidaExistente.id },
          data: { conta_id: novaConta.id, subcategoria_id: null, descricao: `[Saída] ${baseDesc}`, valor: valorNumerico,
            tipo: 'Transferencia', data_transacao: new Date(data_transacao), status, transferencia_direcao: 'Saida' },
        });
        await tx.transacao.update({
          where: { id: entradaExistente.id },
          data: { conta_id: novaContaDestino.id, subcategoria_id: null, descricao: `[Entrada] ${baseDesc}`, valor: valorNumerico,
            tipo: 'Transferencia', data_transacao: new Date(data_transacao), status, transferencia_direcao: 'Entrada' },
        });

        const sourceImpact = calculateBalanceImpactCents({
          accountType: novaConta.tipo, transactionType: 'Transferencia', status,
          description: `[Saída] ${baseDesc}`, value: valorNumerico,
        });
        const destinationImpact = calculateBalanceImpactCents({
          accountType: novaContaDestino.tipo, transactionType: 'Transferencia', status,
          description: `[Entrada] ${baseDesc}`, value: valorNumerico,
        });
        if (sourceImpact !== 0) await tx.contaBancaria.update({
          where: { id: novaConta.id }, data: { saldo_atual: { increment: fromCents(sourceImpact) } },
        });
        if (destinationImpact !== 0) await tx.contaBancaria.update({
          where: { id: novaContaDestino.id }, data: { saldo_atual: { increment: fromCents(destinationImpact) } },
        });
        await recordFinancialAudit(tx, {
          usuarioId: usuario_id, action: 'EDITAR_TRANSFERENCIA', entity: 'TransferenciaGrupo',
          entityId: transacaoExistente.transferencia_grupo_id ?? id,
          data: { conta_origem_id: novaConta.id, conta_destino_id: novaContaDestino.id },
        });
        return saida;
      }

      const oldImpact = calculateBalanceImpactCents({
        accountType: transacaoExistente.conta.tipo, transactionType: transacaoExistente.tipo,
        status: transacaoExistente.status, description: transacaoExistente.descricao,
        value: transacaoExistente.valor,
        recurring: transacaoExistente.recorrente, installmentNumber: transacaoExistente.parcela_atual,
      });
      if (oldImpact !== 0) await tx.contaBancaria.update({
        where: { id: transacaoExistente.conta_id },
        data: { saldo_atual: { increment: fromCents(-oldImpact) } },
      });

      if (twinTransacao) {
        const oldTwinImpact = calculateBalanceImpactCents({
          accountType: twinTransacao.conta.tipo, transactionType: twinTransacao.tipo,
          status: twinTransacao.status, description: twinTransacao.descricao, value: twinTransacao.valor,
        });
        if (oldTwinImpact !== 0) await tx.contaBancaria.update({
          where: { id: twinTransacao.conta_id },
          data: { saldo_atual: { increment: fromCents(-oldTwinImpact) } },
        });
      }

      const newImpact = calculateBalanceImpactCents({
        accountType: novaConta.tipo, transactionType: tipo, status, description: descricao, value: valorNumerico,
        recurring: transacaoExistente.recorrente, installmentNumber: transacaoExistente.parcela_atual,
      });
      if (newImpact !== 0) await tx.contaBancaria.update({
        where: { id: novaConta.id }, data: { saldo_atual: { increment: fromCents(newImpact) } },
      });

      if (twinTransacao) {
        const newTwinImpact = calculateBalanceImpactCents({
          accountType: twinTransacao.conta.tipo, transactionType: 'Transferencia', status,
          description: twinTransacao.descricao, value: valorNumerico,
        });
        if (newTwinImpact !== 0) await tx.contaBancaria.update({
          where: { id: twinTransacao.conta_id },
          data: { saldo_atual: { increment: fromCents(newTwinImpact) } },
        });
      }

      // --- 3. ATUALIZA AS TRANSAÇÕES NO BANCO ---
      // A. Atualiza a transação principal
      const transacaoAtualizada = await tx.transacao.update({
        where: { id },
        data: {
          conta_id,
          subcategoria_id: subcategoria_id || null,
          descricao,
          valor: valorNumerico,
          tipo,
          data_transacao: new Date(data_transacao),
          status
        }
      });

      // B. Atualiza a transação gêmea (se existir)
      if (twinTransacao) {
        const baseDesc = descricao.startsWith('[Entrada]') || descricao.startsWith('[Saída]') 
          ? descricao.slice(9) 
          : descricao;
        const twinPrefix = twinTransacao.descricao.startsWith('[Saída]') ? '[Saída]' : '[Entrada]';
        
        await tx.transacao.update({
          where: { id: twinTransacao.id },
          data: {
            subcategoria_id: subcategoria_id || null,
            descricao: `${twinPrefix} ${baseDesc}`,
            valor: valorNumerico,
            data_transacao: new Date(data_transacao),
            status
          }
        });
      }
      await recordFinancialAudit(tx, {
        usuarioId: usuario_id, action: 'EDITAR', entity: 'Transacao', entityId: id,
        data: { conta_anterior_id: transacaoExistente.conta_id, conta_nova_id: conta_id, possui_par: Boolean(twinTransacao) },
      });
      return transacaoAtualizada;
    });
  }

  async deletarTransacao(id: string, usuario_id: string) {
    const transacaoExistente = await prisma.transacao.findUnique({
      where: { id },
      include: {
        conta: true,
        pagamento_fatura_saida: true,
        pagamento_fatura_entrada: true,
      }
    });

    if (!transacaoExistente || transacaoExistente.usuario_id !== usuario_id) {
      throw new Error("Transação não encontrada.");
    }

    // Identifica se tem uma transação gêmea (outro lado da transferência)
    let twinTransacao: any = null;

    if (transacaoExistente.tipo === 'Transferencia') {
      if (transacaoExistente.transferencia_grupo_id) {
        twinTransacao = await prisma.transacao.findFirst({
          where: {
            usuario_id,
            transferencia_grupo_id: transacaoExistente.transferencia_grupo_id,
            id: { not: id },
          },
          include: { conta: true },
        });
      }
      const isEntrada = transacaoExistente.descricao.startsWith('[Entrada]');
      const isSaida = transacaoExistente.descricao.startsWith('[Saída]');
      
      if (!twinTransacao && (isEntrada || isSaida)) {
        const baseDesc = transacaoExistente.descricao.slice(9);
        const oppositePrefix = isEntrada ? '[Saída]' : '[Entrada]';
        
        twinTransacao = await prisma.transacao.findFirst({
          where: {
            usuario_id,
            tipo: 'Transferencia',
            descricao: {
              startsWith: oppositePrefix
            },
            data_transacao: transacaoExistente.data_transacao,
            valor: transacaoExistente.valor,
            id: { not: id }
          },
          include: { conta: true }
        });
        
        if (twinTransacao && twinTransacao.descricao.slice(9) !== baseDesc) {
          twinTransacao = null;
        }
      }
    }

    return prisma.$transaction(async (tx) => {
      const invoicePayment = transacaoExistente.pagamento_fatura_saida
        ?? transacaoExistente.pagamento_fatura_entrada;
      if (invoicePayment) {
        await tx.pagamentoFatura.delete({ where: { id: invoicePayment.id } });
        await tx.faturaCartao.update({
          where: { id: invoicePayment.fatura_id },
          data: { total_pago: { decrement: invoicePayment.valor } },
        });
      }
      const impact = calculateBalanceImpactCents({
        accountType: transacaoExistente.conta.tipo, transactionType: transacaoExistente.tipo,
        status: transacaoExistente.status, description: transacaoExistente.descricao,
        value: transacaoExistente.valor,
        recurring: transacaoExistente.recorrente, installmentNumber: transacaoExistente.parcela_atual,
      });
      if (impact !== 0) await tx.contaBancaria.update({
        where: { id: transacaoExistente.conta_id },
        data: { saldo_atual: { increment: fromCents(-impact) } },
      });

      if (twinTransacao) {
        const twinImpact = calculateBalanceImpactCents({
          accountType: twinTransacao.conta.tipo, transactionType: twinTransacao.tipo,
          status: twinTransacao.status, description: twinTransacao.descricao, value: twinTransacao.valor,
        });
        if (twinImpact !== 0) await tx.contaBancaria.update({
          where: { id: twinTransacao.conta_id },
          data: { saldo_atual: { increment: fromCents(-twinImpact) } },
        });
      }

      // 3. DELETA AS TRANSAÇÕES
      await tx.transacao.delete({
        where: { id }
      });

      if (twinTransacao) {
        await tx.transacao.delete({
          where: { id: twinTransacao.id }
        });
      }

      if (invoicePayment) await this.invoiceService.refreshStatus(tx, invoicePayment.fatura_id);

      await recordFinancialAudit(tx, {
        usuarioId: usuario_id,
        action: invoicePayment ? 'ESTORNAR_PAGAMENTO_FATURA' : 'EXCLUIR',
        entity: 'Transacao', entityId: id,
        data: { possui_par: Boolean(twinTransacao), fatura_id: invoicePayment?.fatura_id },
      });

      return { message: "Transação excluída com sucesso." };
    });
  }

  async deletarTransacoesEmLote(ids: string[], usuario_id: string) {
    if (!ids || ids.length === 0) {
      return { message: "Nenhuma transação selecionada." };
    }

    return prisma.$transaction(async (tx) => {
      const idsExcluidos = new Set<string>();

      for (const id of ids) {
        if (idsExcluidos.has(id)) {
          continue; // Já foi excluída como gêmea de outra transferência neste lote
        }

        const transacao = await tx.transacao.findUnique({
          where: { id }
        });

        if (!transacao) {
          continue;
        }

        if (transacao.usuario_id !== usuario_id) {
          throw new Error(`Sem permissão para deletar a transação ${id}`);
        }

        const invoicePayment = await tx.pagamentoFatura.findFirst({
          where: { OR: [{ transacao_saida_id: id }, { transacao_entrada_id: id }] },
        });
        if (invoicePayment) {
          throw new Error('Pagamentos de fatura devem ser estornados individualmente.');
        }

        let twinTransacao: any = null;
        if (transacao.tipo === 'Transferencia') {
          if (transacao.transferencia_grupo_id) {
            twinTransacao = await tx.transacao.findFirst({
              where: {
                usuario_id,
                transferencia_grupo_id: transacao.transferencia_grupo_id,
                id: { not: id },
              },
            });
          }
          const isEntrada = transacao.descricao.startsWith('[Entrada]');
          const isSaida = transacao.descricao.startsWith('[Saída]');

          if (!twinTransacao && (isEntrada || isSaida)) {
            const baseDesc = transacao.descricao.slice(9);
            const oppositePrefix = isEntrada ? '[Saída]' : '[Entrada]';

            twinTransacao = await tx.transacao.findFirst({
              where: {
                usuario_id,
                tipo: 'Transferencia',
                descricao: { startsWith: oppositePrefix },
                data_transacao: transacao.data_transacao,
                valor: transacao.valor,
                id: { not: id }
              }
            });

            if (twinTransacao && twinTransacao.descricao.slice(9) !== baseDesc) {
              twinTransacao = null;
            }
          }
        }

        // 1. REVERTE SALDO DA TRANSAÇÃO PRINCIPAL (Busca o saldo mais recente do banco dentro da transação)
        const contaPrincipal = await tx.contaBancaria.findUnique({
          where: { id: transacao.conta_id }
        });
        if (!contaPrincipal) {
          throw new Error(`Conta ${transacao.conta_id} não encontrada.`);
        }

        const impact = calculateBalanceImpactCents({
          accountType: contaPrincipal.tipo, transactionType: transacao.tipo,
          status: transacao.status, description: transacao.descricao, value: transacao.valor,
          recurring: transacao.recorrente, installmentNumber: transacao.parcela_atual,
        });
        if (impact !== 0) await tx.contaBancaria.update({
          where: { id: transacao.conta_id },
          data: { saldo_atual: { increment: fromCents(-impact) } },
        });

        // 2. REVERTE SALDO DA TRANSAÇÃO GÊMEA
        if (twinTransacao) {
          const contaTwin = await tx.contaBancaria.findUnique({
            where: { id: twinTransacao.conta_id }
          });
          if (!contaTwin) {
            throw new Error(`Conta gêmea ${twinTransacao.conta_id} não encontrada.`);
          }

          const twinImpact = calculateBalanceImpactCents({
            accountType: contaTwin.tipo, transactionType: twinTransacao.tipo,
            status: twinTransacao.status, description: twinTransacao.descricao, value: twinTransacao.valor,
          });
          if (twinImpact !== 0) await tx.contaBancaria.update({
            where: { id: twinTransacao.conta_id },
            data: { saldo_atual: { increment: fromCents(-twinImpact) } },
          });
        }

        // 3. DELETA AS TRANSAÇÕES
        await tx.transacao.delete({
          where: { id }
        });
        idsExcluidos.add(id);

        if (twinTransacao) {
          await tx.transacao.delete({
            where: { id: twinTransacao.id }
          });
          idsExcluidos.add(twinTransacao.id);
        }
      }

      await recordFinancialAudit(tx, {
        usuarioId: usuario_id, action: 'EXCLUIR_LOTE', entity: 'Transacao',
        data: { quantidade: idsExcluidos.size },
      });

      return { message: `${idsExcluidos.size} transações excluídas com sucesso.` };
    });
  }

  async prorrogarRecorrencia(transacao_pai_id: string, novos_meses: number, usuario_id: string) {
    if (!transacao_pai_id) {
      throw new Error("transacao_pai_id é obrigatório.");
    }
    if (!novos_meses || novos_meses < 1) {
      throw new Error("novos_meses deve ser pelo menos 1.");
    }

    const transacoes = await prisma.transacao.findMany({
      where: {
        transacao_pai_id,
        usuario_id
      },
      include: { conta: { include: { cartao_detalhe: true } } },
      orderBy: [{ parcela_atual: 'asc' }, { data_transacao: 'asc' }]
    });

    if (transacoes.length === 0) {
      throw new Error("Recorrência não encontrada.");
    }

    const totalExistente = Math.max(...transacoes.map((item) => item.parcela_atual));
    const novosTotal = totalExistente + novos_meses;
    const ultimaOcorrencia = transacoes.filter((item) => item.parcela_atual === totalExistente);
    const ultima = ultimaOcorrencia[0];
    const primeira = transacoes[0];
    const ultimaData = new Date(ultima.data_transacao);
    const anchorDay = primeira.data_transacao.getUTCDate();

    return prisma.$transaction(async (tx) => {
      await tx.transacao.updateMany({
        where: {
          transacao_pai_id,
          usuario_id
        },
        data: {
          total_parcelas: novosTotal
        }
      });

      if (ultima.tipo === 'Transferencia') {
        const saida = ultimaOcorrencia.find((item) => item.transferencia_direcao === 'Saida');
        const entrada = ultimaOcorrencia.find((item) => item.transferencia_direcao === 'Entrada');
        if (!saida || !entrada) throw new Error('A recorrência de transferência está inconsistente.');
        const descricaoBase = saida.descricao.replace(/^\[(?:Saída|Entrada)\]\s*/, '');
        for (let i = 1; i <= novos_meses; i++) {
          const group = await tx.transferenciaGrupo.create({ data: { usuario_id, descricao: descricaoBase } });
          const comum = {
            usuario_id, subcategoria_id: null, valor: saida.valor, tipo: 'Transferencia' as const,
            data_transacao: addMonthsClamped(ultimaData, i, anchorDay), status: 'Pendente' as const,
            parcela_atual: totalExistente + i, total_parcelas: novosTotal, transacao_pai_id,
            recorrente: true, transferencia_grupo_id: group.id,
          };
          await tx.transacao.createMany({ data: [
            { ...comum, id: uuidv4(), conta_id: saida.conta_id, descricao: `[Saída] ${descricaoBase}`, transferencia_direcao: 'Saida' },
            { ...comum, id: uuidv4(), conta_id: entrada.conta_id, descricao: `[Entrada] ${descricaoBase}`, transferencia_direcao: 'Entrada' },
          ] });
        }
      } else {
        const novasTransacoes: Prisma.TransacaoUncheckedCreateInput[] = [];
        for (let i = 1; i <= novos_meses; i++) novasTransacoes.push({
          id: uuidv4(), usuario_id, conta_id: ultima.conta_id, subcategoria_id: ultima.subcategoria_id,
          descricao: ultima.descricao, valor: ultima.valor, tipo: ultima.tipo,
          data_transacao: addMonthsClamped(ultimaData, i, anchorDay), status: 'Pendente',
          parcela_atual: totalExistente + i, total_parcelas: novosTotal,
          transacao_pai_id, recorrente: true,
        });
        const cardDetails = ultima.conta.cartao_detalhe;
        if (cardDetails) await this.invoiceService.assignCardTransactions(
          tx, usuario_id, ultima.conta_id, cardDetails.dia_fechamento, cardDetails.dia_vencimento, novasTransacoes,
        );
        await tx.transacao.createMany({ data: novasTransacoes });
      }

      await recordFinancialAudit(tx, {
        usuarioId: usuario_id, action: 'PRORROGAR_RECORRENCIA', entity: 'Recorrencia', entityId: transacao_pai_id,
        data: { novos_meses, total_anterior: totalExistente, novo_total: novosTotal },
      });

      return {
        message: `Recorrência prorrogada com sucesso por mais ${novos_meses} meses (Total de ${novosTotal} meses).`,
        novosTotal
      };
    });
  }

  async cancelarRecorrencia(transacao_pai_id: string, parcela_limite: number, usuario_id: string) {
    if (!transacao_pai_id) {
      throw new Error("transacao_pai_id é obrigatório.");
    }
    if (!parcela_limite || parcela_limite < 1) {
      throw new Error("parcela_limite inválida.");
    }

    const transacoes = await prisma.transacao.findMany({
      where: {
        transacao_pai_id,
        usuario_id
      },
      include: { conta: true, fatura: true },
      orderBy: { parcela_atual: 'asc' }
    });

    if (transacoes.length === 0) {
      throw new Error("Recorrência não encontrada.");
    }

    const totalExistente = Math.max(...transacoes.map((item) => item.parcela_atual));
    if (parcela_limite >= totalExistente) throw new Error('Escolha uma competência anterior ao fim atual da recorrência.');
    const removidas = transacoes.filter((item) => item.parcela_atual > parcela_limite);
    if (removidas.some((item) => item.status === 'Pago')) {
      throw new Error('Não é possível remover competências que já foram pagas ou recebidas.');
    }
    if (removidas.some((item) => item.fatura && Number(item.fatura.total_pago) > 0)) {
      throw new Error('Não é possível remover lançamentos de uma fatura que já recebeu pagamento.');
    }
    const faturasAfetadas = [...new Set(removidas.flatMap((item) => item.fatura_id ? [item.fatura_id] : []))];
    const ocorrenciasRemovidas = new Set(removidas.map((item) => item.parcela_atual)).size;

    return prisma.$transaction(async (tx) => {
      await tx.transacao.deleteMany({
        where: {
          transacao_pai_id,
          usuario_id,
          parcela_atual: {
            gt: parcela_limite
          }
        }
      });

      await tx.transacao.updateMany({
        where: {
          transacao_pai_id,
          usuario_id,
          parcela_atual: {
            lte: parcela_limite
          }
        },
        data: {
          total_parcelas: parcela_limite
        }
      });

      for (const invoiceId of faturasAfetadas) {
        const restantes = await tx.transacao.findMany({ where: { fatura_id: invoiceId } });
        const totalCents = restantes.reduce((sum, item) => sum + calculateBalanceImpactCents({
          accountType: 'CartaoCredito', transactionType: item.tipo, status: item.status,
          description: item.descricao, value: item.valor,
        }), 0);
        await tx.faturaCartao.update({ where: { id: invoiceId }, data: { total: fromCents(totalCents) } });
        await this.invoiceService.refreshStatus(tx, invoiceId);
      }

      await recordFinancialAudit(tx, {
        usuarioId: usuario_id, action: 'ENCERRAR_RECORRENCIA', entity: 'Recorrencia', entityId: transacao_pai_id,
        data: { parcela_limite, total_anterior: totalExistente, ocorrencias_removidas: ocorrenciasRemovidas, faturas_afetadas: faturasAfetadas },
      });

      return {
        message: `Recorrência encerrada na competência ${parcela_limite}. ${ocorrenciasRemovidas} competências futuras foram removidas.`,
        novoTotal: parcela_limite
      };
    });
  }
}
