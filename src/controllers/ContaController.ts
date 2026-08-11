import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { assertAccountOwnership } from '../services/OwnershipService';
import { calculateAccountBalanceCents } from '../domain/finance/balanceImpact';
import { fromCents } from '../domain/finance/money';

function getFaturaRange(diaFechamento: number): { start: Date; end: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  let start: Date;
  let end: Date;

  const diaAtual = now.getDate();
  const limiteFechamento = diaFechamento - 1;

  if (diaAtual <= limiteFechamento) {
    start = new Date(year, month - 1, diaFechamento, 0, 0, 0, 0);
    end = new Date(year, month, limiteFechamento, 23, 59, 59, 999);
  } else {
    start = new Date(year, month, diaFechamento, 0, 0, 0, 0);
    end = new Date(year, month + 1, limiteFechamento, 23, 59, 59, 999);
  }

  return { start, end };
}

function getClosedFaturaRange(diaFechamento: number): { start: Date; end: Date } {
  const openRange = getFaturaRange(diaFechamento);
  const end = new Date(openRange.start.getTime() - 1);
  const start = new Date(
    openRange.start.getFullYear(),
    openRange.start.getMonth() - 1,
    diaFechamento,
    0,
    0,
    0,
    0
  );

  return { start, end };
}

function getInvoiceImpact(transacao: { tipo: string; descricao: string; valor: unknown }): number {
  const valor = Number(transacao.valor);

  if (transacao.tipo === 'Despesa') {
    return valor;
  }
  if (transacao.tipo === 'Transferencia') {
    return transacao.descricao.includes('[Saída]') ? valor : -valor;
  }
  if (transacao.tipo === 'Receita') {
    return -valor;
  }

  return 0;
}

function getBillingMonth(dataTransacao: Date, diaFechamento: number): string {
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

  const monthStr = String(month + 1).padStart(2, '0');
  return `${year}-${monthStr}`;
}

function isInvoicePayment(descricao: string): boolean {
  const descLower = (descricao || '').toLowerCase();
  return descLower.includes('pagamento fatura') || descLower.includes('liquidação fatura') || descLower.includes('liquidacao fatura');
}

function getInvoiceMonthPaid(dataTransacao: Date, diaFechamento: number): string {
  const d = new Date(dataTransacao);
  const day = d.getUTCDate();
  let year = d.getUTCFullYear();
  let month = d.getUTCMonth(); // 0-indexed

  if (day < diaFechamento) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }

  const monthStr = String(month + 1).padStart(2, '0');
  return `${year}-${monthStr}`;
}

export function findNextOpenInvoice<T extends { data_fechamento: Date }>(
  invoices: T[],
  now: Date,
): T | undefined {
  return invoices.reduce<T | undefined>((closest, invoice) => {
    if (invoice.data_fechamento <= now) return closest;
    if (!closest || invoice.data_fechamento < closest.data_fechamento) return invoice;
    return closest;
  }, undefined);
}

export class ContaController {
  create = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { nome, tipo, saldo_inicial, limite_total, dia_fechamento, dia_vencimento, conta_pagamento_padrao_id } = req.body;

    try {
      if (tipo === 'CartaoCredito') {
        if (conta_pagamento_padrao_id) {
          const contaPagamento = await assertAccountOwnership(conta_pagamento_padrao_id, usuario_id);
          if (contaPagamento.tipo === 'CartaoCredito') {
            return res.status(400).json({ message: 'A conta de pagamento não pode ser outro cartão de crédito.' });
          }
        }
        const conta = await prisma.contaBancaria.create({
          data: {
            usuario_id,
            nome,
            tipo,
            saldo_inicial: 0, // Cartões não possuem saldo inicial positivo como uma conta corrente
            saldo_atual: 0,
            cartao_detalhe: {
              create: {
                limite_total,
                dia_fechamento,
                dia_vencimento,
                conta_pagamento_padrao_id
              } as any
            }
          },
          include: {
            cartao_detalhe: true
          }
        });
        return res.status(201).json(conta);
      }

      // Outros tipos de conta (Corrente, Poupanca, Dinheiro)
      const conta = await prisma.contaBancaria.create({
        data: {
          usuario_id,
          nome,
          tipo,
          saldo_inicial,
          saldo_atual: saldo_inicial
        }
      });
      return res.status(201).json(conta);

    } catch (error: any) {
      return res.status(400).json({ message: 'Erro ao criar conta', error: error.message });
    }
  };

  list = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;

    try {
      const contas = await prisma.contaBancaria.findMany({
        where: { usuario_id },
        include: {
          cartao_detalhe: true
        },
        orderBy: { nome: 'asc' }
      });
      
      const contasComSaldoAtualizado = await Promise.all(
        contas.map(async (conta) => {
          // O saldo é mantido atomicamente nas operações financeiras; listar é somente leitura.
          const contaAtualizada = conta;

          // Calcula dinamicamente o valor da fatura do mês atual para cartões de crédito
          if (contaAtualizada.tipo === 'CartaoCredito' && contaAtualizada.cartao_detalhe) {
            const explicitInvoices = await prisma.faturaCartao.findMany({
              where: { cartao_id: contaAtualizada.id },
              include: { transacoes: true },
              orderBy: { data_fechamento: 'desc' },
            });
            if (explicitInvoices.length > 0) {
              const now = new Date();
              const openInvoice = findNextOpenInvoice(explicitInvoices, now);
              const closedInvoice = explicitInvoices.find((invoice) =>
                invoice.data_fechamento <= now && Number(invoice.total) > Number(invoice.total_pago),
              );
              const legacyTransactions = await prisma.transacao.findMany({
                where: { conta_id: contaAtualizada.id, usuario_id, fatura_id: null },
              });
              const invoiceBalance = (invoice: typeof openInvoice): number => {
                if (!invoice) return 0;
                const linkedTotal = invoice.transacoes.reduce(
                  (sum, transaction) => sum + getInvoiceImpact(transaction),
                  0,
                );
                let legacyTotal = 0;
                let legacyPaid = 0;
                for (const transaction of legacyTransactions) {
                  const payment = isInvoicePayment(transaction.descricao);
                  const competence = payment
                    ? getInvoiceMonthPaid(transaction.data_transacao, contaAtualizada.cartao_detalhe!.dia_fechamento)
                    : getBillingMonth(transaction.data_transacao, contaAtualizada.cartao_detalhe!.dia_fechamento);
                  if (competence !== invoice.competencia) continue;
                  if (payment) legacyPaid += Number(transaction.valor);
                  else legacyTotal += getInvoiceImpact(transaction);
                }
                return linkedTotal + legacyTotal - Number(invoice.total_pago) - legacyPaid;
              };
              return {
                ...contaAtualizada,
                fatura_atual: Math.max(0, invoiceBalance(openInvoice)),
                fatura_fechada: Math.max(0, invoiceBalance(closedInvoice)),
                fatura_fechada_id: closedInvoice?.id,
                fatura_fechada_competencia: closedInvoice?.competencia,
                fatura_fechada_vencimento: closedInvoice?.data_vencimento,
              };
            }
            const { start, end } = getFaturaRange(contaAtualizada.cartao_detalhe.dia_fechamento);
            const closedRange = getClosedFaturaRange(contaAtualizada.cartao_detalhe.dia_fechamento);

            const transacoesFatura = await prisma.transacao.findMany({
              where: {
                conta_id: contaAtualizada.id,
                OR: [
                  { data_transacao: { gte: closedRange.start, lte: closedRange.end } },
                  { data_transacao: { gte: start, lte: end } }
                ]
              }
            });

            let faturaAtual = 0;
            let faturaFechada = 0;
            for (const t of transacoesFatura) {
              if (isInvoicePayment(t.descricao)) {
                // Um pagamento feito no ciclo aberto liquida a fatura imediatamente anterior.
                if (t.data_transacao >= start && t.data_transacao <= end) {
                  faturaFechada -= Number(t.valor);
                }
                continue;
              }

              const impacto = getInvoiceImpact(t);
              if (t.data_transacao >= closedRange.start && t.data_transacao <= closedRange.end) {
                faturaFechada += impacto;
              } else {
                faturaAtual += impacto;
              }
            }

            return {
              ...contaAtualizada,
              fatura_atual: faturaAtual,
              fatura_fechada: faturaFechada
            };
          }

          return contaAtualizada;
        })
      );

      return res.json(contasComSaldoAtualizado);
    } catch (error: any) {
      return res.status(500).json({ message: 'Erro ao listar contas', error: error.message });
    }
  };

  update = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { id } = req.params;
    const { nome, saldo_inicial, limite_total, dia_fechamento, dia_vencimento, conta_pagamento_padrao_id } = req.body;

    try {
      const conta = await prisma.contaBancaria.findFirst({
        where: { id, usuario_id }
      });

      if (!conta) {
        return res.status(404).json({ message: 'Conta não encontrada.' });
      }

      if (conta_pagamento_padrao_id) {
        const contaPagamento = await assertAccountOwnership(conta_pagamento_padrao_id, usuario_id);
        if (contaPagamento.id === id || contaPagamento.tipo === 'CartaoCredito') {
          return res.status(400).json({ message: 'Selecione uma conta de pagamento válida.' });
        }
      }

      const contaAtualizada = await prisma.contaBancaria.update({
        where: { id },
        data: {
          nome,
          ...(saldo_inicial !== undefined && { saldo_inicial }),
          ...(conta.tipo === 'CartaoCredito' && 
            (limite_total !== undefined || dia_fechamento !== undefined || dia_vencimento !== undefined || conta_pagamento_padrao_id !== undefined) && {
            cartao_detalhe: {
              update: {
                ...(limite_total !== undefined && { limite_total }),
                ...(dia_fechamento !== undefined && { dia_fechamento }),
                ...(dia_vencimento !== undefined && { dia_vencimento }),
                ...(conta_pagamento_padrao_id !== undefined && { conta_pagamento_padrao_id }),
              } as any
            }
          })
        },
        include: { cartao_detalhe: true }
      });

      // Recalcula o saldo_atual após a atualização do saldo_inicial ou outras alterações
      const transacoes = await prisma.transacao.findMany({
        where: { conta_id: id }
      });

      const saldoCalculado = fromCents(calculateAccountBalanceCents(
        contaAtualizada.tipo, contaAtualizada.saldo_inicial, transacoes,
      ));

      const contaFinal = await prisma.contaBancaria.update({
        where: { id },
        data: { saldo_atual: saldoCalculado },
        include: { cartao_detalhe: true }
      });

      return res.json(contaFinal);
    } catch (error: any) {
      return res.status(400).json({ message: 'Erro ao atualizar conta', error: error.message });
    }
  };

  recalculate = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { id } = req.params;

    try {
      const conta = await prisma.contaBancaria.findFirst({
        where: { id, usuario_id }
      });

      if (!conta) {
        return res.status(404).json({ message: 'Conta não encontrada.' });
      }

      // Busca todas as transações desta conta
      const transacoes = await prisma.transacao.findMany({
        where: { conta_id: id }
      });

      const saldoCalculado = fromCents(calculateAccountBalanceCents(
        conta.tipo, conta.saldo_inicial, transacoes,
      ));

      // Atualiza o saldo no banco de dados
      const contaAtualizada = await prisma.contaBancaria.update({
        where: { id },
        data: { saldo_atual: saldoCalculado },
        include: { cartao_detalhe: true }
      });

      return res.json(contaAtualizada);
    } catch (error: any) {
      return res.status(400).json({ message: 'Erro ao recalcular saldo da conta', error: error.message });
    }
  };

  getFaturas = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { id } = req.params;

    try {
      const conta = await prisma.contaBancaria.findFirst({
        where: { id, usuario_id, tipo: 'CartaoCredito' },
        include: { cartao_detalhe: true }
      });

      if (!conta || !conta.cartao_detalhe) {
        return res.status(404).json({ message: 'Cartão de crédito não encontrado.' });
      }

      const explicitInvoices = await prisma.faturaCartao.findMany({
        where: { cartao_id: id, usuario_id },
        include: { transacoes: true, pagamentos: true },
        orderBy: { competencia: 'asc' },
      });
      if (explicitInvoices.length > 0) {
        // Transacoes criadas antes da introducao de faturas explicitas podem nao ter
        // fatura_id. Nao podemos ignora-las so porque o cartao tambem possui faturas
        // novas, pois isso faz parcelas legadas desaparecerem da interface.
        const legacyTransactions = await prisma.transacao.findMany({
          where: { conta_id: id, usuario_id, fatura_id: null },
          orderBy: { data_transacao: 'asc' },
        });

        const invoicesByMonth = new Map<string, any>(explicitInvoices.map((invoice) => [
          invoice.competencia,
          {
            id: invoice.id,
            mes: invoice.competencia,
            status: invoice.status,
            data_fechamento: invoice.data_fechamento,
            data_vencimento: invoice.data_vencimento,
            total_pago: Number(invoice.total_pago),
            transacoes: invoice.transacoes.map((transaction) => ({
              ...transaction,
              impacto_fatura: getInvoiceImpact(transaction),
            })),
            pagamentos: invoice.pagamentos,
          },
        ]));

        for (const transaction of legacyTransactions) {
          const payment = isInvoicePayment(transaction.descricao);
          const month = payment
            ? getInvoiceMonthPaid(transaction.data_transacao, conta.cartao_detalhe.dia_fechamento)
            : getBillingMonth(transaction.data_transacao, conta.cartao_detalhe.dia_fechamento);
          let invoice = invoicesByMonth.get(month);
          if (!invoice) {
            invoice = { mes: month, total_pago: 0, transacoes: [], pagamentos: [] };
            invoicesByMonth.set(month, invoice);
          }
          if (payment) invoice.total_pago += Number(transaction.valor);
          invoice.transacoes.push({
            ...transaction,
            impacto_fatura: payment ? 0 : getInvoiceImpact(transaction),
          });
        }

        const faturas = Array.from(invoicesByMonth.values())
          .map((invoice) => {
            // A soma dos lancamentos exibidos e a fonte de verdade da composicao da
            // fatura. Isso tambem corrige totais defasados durante a transicao legada.
            const total = invoice.transacoes.reduce(
              (sum: number, transaction: any) => sum + Number(transaction.impacto_fatura),
              0,
            );
            return {
              ...invoice,
              total,
              saldo_restante: Math.max(0, total - invoice.total_pago),
            };
          })
          .sort((a, b) => a.mes.localeCompare(b.mes));

        return res.json({
          conta: {
            id: conta.id,
            nome: conta.nome,
            limite_total: conta.cartao_detalhe.limite_total,
            dia_fechamento: conta.cartao_detalhe.dia_fechamento,
            dia_vencimento: conta.cartao_detalhe.dia_vencimento,
          },
          faturas,
        });
      }

      // Busca todas as transações deste cartão
      const transacoes = await prisma.transacao.findMany({
        where: { conta_id: id },
        orderBy: { data_transacao: 'asc' }
      });

      // Agrupa as transações por mês de faturamento
      const faturasMap: Record<string, { mes: string; total: number; total_pago: number; transacoes: any[] }> = {};

      const diaFechamento = conta.cartao_detalhe.dia_fechamento;

      for (const t of transacoes) {
        const isPayment = isInvoicePayment(t.descricao);
        const mesFatura = isPayment 
          ? getInvoiceMonthPaid(t.data_transacao, diaFechamento)
          : getBillingMonth(t.data_transacao, diaFechamento);

        if (!faturasMap[mesFatura]) {
          faturasMap[mesFatura] = {
            mes: mesFatura,
            total: 0,
            total_pago: 0,
            transacoes: []
          };
        }

        const valor = Number(t.valor);
        let impacto = 0;

        if (isPayment) {
          faturasMap[mesFatura].total_pago += valor;
          impacto = 0;
        } else {
          if (t.tipo === 'Despesa') {
            impacto = valor;
          } else if (t.tipo === 'Transferencia') {
            if (t.descricao.includes('[Saída]')) {
              impacto = valor;
            } else {
              impacto = -valor;
            }
          } else if (t.tipo === 'Receita') {
            impacto = -valor;
          }
          faturasMap[mesFatura].total += impacto;
        }

        faturasMap[mesFatura].transacoes.push({
          ...t,
          impacto_fatura: impacto
        });
      }

      // Converte para array ordenado por data
      const faturas = Object.values(faturasMap).sort((a, b) => a.mes.localeCompare(b.mes));

      return res.json({
        conta: {
          id: conta.id,
          nome: conta.nome,
          limite_total: conta.cartao_detalhe.limite_total,
          dia_fechamento: conta.cartao_detalhe.dia_fechamento,
          dia_vencimento: conta.cartao_detalhe.dia_vencimento
        },
        faturas
      });
    } catch (error: any) {
      return res.status(400).json({ message: 'Erro ao obter faturas do cartão', error: error.message });
    }
  };

  delete = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { id } = req.params;

    try {
      const conta = await prisma.contaBancaria.findFirst({
        where: { id, usuario_id }
      });

      if (!conta) {
        return res.status(404).json({ message: 'Conta não encontrada.' });
      }

      await prisma.$transaction(async (tx) => {
        // 1. Limpa a referência de conta_pagamento_padrao_id em cartões de crédito
        await tx.cartaoCreditoDetalhe.updateMany({
          where: { conta_pagamento_padrao_id: id },
          data: { conta_pagamento_padrao_id: null }
        });

        // 2. Remove detalhes do cartão se for do tipo CartaoCredito
        if (conta.tipo === 'CartaoCredito') {
          await tx.cartaoCreditoDetalhe.deleteMany({
            where: { conta_id: id }
          });
        }

        // 3. Remove todas as transações associadas a esta conta
        await tx.transacao.deleteMany({
          where: { conta_id: id }
        });

        // 4. Remove a conta em si
        await tx.contaBancaria.delete({
          where: { id }
        });
      });

      return res.json({ message: 'Conta excluída com sucesso.' });
    } catch (error: any) {
      return res.status(400).json({ message: 'Erro ao excluir conta', error: error.message });
    }
  };
}
