import { Request, Response } from 'express';
import prisma from '../lib/prisma';

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

export class ContaController {
  create = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { nome, tipo, saldo_inicial, limite_total, dia_fechamento, dia_vencimento, conta_pagamento_padrao_id } = req.body;

    try {
      if (tipo === 'CartaoCredito') {
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
          // Busca todas as transações desta conta
          const transacoes = await prisma.transacao.findMany({
            where: { conta_id: conta.id }
          });

          let saldoCalculado = 0;

          if (conta.tipo === 'CartaoCredito') {
            // Para cartões de crédito: despesas e saídas aumentam o saldo devedor; entradas (pagamentos) diminuem
            for (const t of transacoes) {
              const valor = Number(t.valor);
              if (t.tipo === 'Despesa') {
                saldoCalculado += valor;
              } else if (t.tipo === 'Transferencia') {
                if (t.descricao.includes('[Saída]')) {
                  saldoCalculado += valor;
                } else {
                  saldoCalculado -= valor;
                }
              } else if (t.tipo === 'Receita') {
                saldoCalculado -= valor;
              }
            }
          } else {
            // Para contas normais: saldo_inicial + receitas - despesas +/- transferências (apenas pagas)
            saldoCalculado = Number(conta.saldo_inicial);
            for (const t of transacoes) {
              if (t.status !== 'Pago') continue;
              const valor = Number(t.valor);
              if (t.tipo === 'Receita') {
                saldoCalculado += valor;
              } else if (t.tipo === 'Despesa') {
                saldoCalculado -= valor;
              } else if (t.tipo === 'Transferencia') {
                if (t.descricao.includes('[Saída]')) {
                  saldoCalculado -= valor;
                } else {
                  saldoCalculado += valor;
                }
              }
            }
          }

          // Atualiza saldo no banco de dados para garantir consistência
          const contaAtualizada = await prisma.contaBancaria.update({
            where: { id: conta.id },
            data: { saldo_atual: saldoCalculado },
            include: { cartao_detalhe: true }
          });

          // Calcula dinamicamente o valor da fatura do mês atual para cartões de crédito
          if (contaAtualizada.tipo === 'CartaoCredito' && contaAtualizada.cartao_detalhe) {
            const { start, end } = getFaturaRange(contaAtualizada.cartao_detalhe.dia_fechamento);

            const transacoesFatura = await prisma.transacao.findMany({
              where: {
                conta_id: contaAtualizada.id,
                data_transacao: {
                  gte: start,
                  lte: end
                }
              }
            });

            let faturaAtual = 0;
            for (const t of transacoesFatura) {
              if (isInvoicePayment(t.descricao)) {
                continue;
              }
              const valor = Number(t.valor);
              if (t.tipo === 'Despesa') {
                faturaAtual += valor;
              } else if (t.tipo === 'Transferencia') {
                if (t.descricao.includes('[Saída]')) {
                  faturaAtual += valor;
                } else {
                  faturaAtual -= valor;
                }
              } else if (t.tipo === 'Receita') {
                faturaAtual -= valor;
              }
            }

            return {
              ...contaAtualizada,
              fatura_atual: faturaAtual
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

      let saldoCalculado = 0;
      if (contaAtualizada.tipo === 'CartaoCredito') {
        for (const t of transacoes) {
          const valor = Number(t.valor);
          if (t.tipo === 'Despesa') {
            saldoCalculado += valor;
          } else if (t.tipo === 'Transferencia') {
            if (t.descricao.includes('[Saída]')) {
              saldoCalculado += valor;
            } else {
              saldoCalculado -= valor;
            }
          } else if (t.tipo === 'Receita') {
            saldoCalculado -= valor;
          }
        }
      } else {
        saldoCalculado = Number(contaAtualizada.saldo_inicial);
        for (const t of transacoes) {
          if (t.status !== 'Pago') continue;
          const valor = Number(t.valor);
          if (t.tipo === 'Receita') {
            saldoCalculado += valor;
          } else if (t.tipo === 'Despesa') {
            saldoCalculado -= valor;
          } else if (t.tipo === 'Transferencia') {
            if (t.descricao.includes('[Saída]')) {
              saldoCalculado -= valor;
            } else {
              saldoCalculado += valor;
            }
          }
        }
      }

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

      let saldoCalculado = 0;

      if (conta.tipo === 'CartaoCredito') {
        // Para cartões de crédito: despesas e saídas aumentam o saldo devedor; entradas (pagamentos) diminuem
        for (const t of transacoes) {
          const valor = Number(t.valor);
          if (t.tipo === 'Despesa') {
            saldoCalculado += valor;
          } else if (t.tipo === 'Transferencia') {
            if (t.descricao.includes('[Saída]')) {
              saldoCalculado += valor;
            } else {
              saldoCalculado -= valor;
            }
          } else if (t.tipo === 'Receita') {
            saldoCalculado -= valor;
          }
        }
      } else {
        // Para contas normais: saldo_inicial + receitas - despesas +/- transferências (apenas pagas)
        saldoCalculado = Number(conta.saldo_inicial);
        for (const t of transacoes) {
          if (t.status !== 'Pago') continue;
          const valor = Number(t.valor);
          if (t.tipo === 'Receita') {
            saldoCalculado += valor;
          } else if (t.tipo === 'Despesa') {
            saldoCalculado -= valor;
          } else if (t.tipo === 'Transferencia') {
            if (t.descricao.includes('[Saída]')) {
              saldoCalculado -= valor;
            } else {
              saldoCalculado += valor;
            }
          }
        }
      }

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
