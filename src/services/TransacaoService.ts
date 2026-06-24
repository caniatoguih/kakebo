import { TransacaoRepository } from '../repositories/TransacaoRepository';
import { Prisma } from '@prisma/client';
import { randomUUID as uuidv4 } from 'crypto';
import prisma from '../lib/prisma';

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

  async criarTransacao(data: any, usuario_id: string) {
    const { total_parcelas, data_transacao, valor, recorrente, ...rest } = data;
    
    // Busca a conta para saber o tipo e atualizar o saldo
    const conta = await prisma.contaBancaria.findUnique({
      where: { id: rest.conta_id }
    });

    if (!conta) {
      throw new Error("Conta bancária não encontrada.");
    }

    const valorNumerico = Number(valor);
    const isRecorrente = !!recorrente;

    // Lógica para recorrência (mensalidades de valor fixo recorrente)
    if (isRecorrente && total_parcelas > 1) {
      const transacoesRecorrentes: Prisma.TransacaoUncheckedCreateInput[] = [];
      const transacao_pai_id = uuidv4();
      
      let dataAtual = new Date(data_transacao);

      for (let i = 1; i <= total_parcelas; i++) {
        transacoesRecorrentes.push({
          ...rest,
          usuario_id,
          valor: valorNumerico, // Valor cheio em cada recorrência
          data_transacao: new Date(dataAtual),
          parcela_atual: i,
          total_parcelas,
          transacao_pai_id,
          recorrente: true,
          status: i === 1 ? rest.status : 'Pendente', // Primeira tem o status informado, próximas ficam Pendente
          id: uuidv4()
        });
        
        // Adiciona 1 mês para a próxima ocorrência
        dataAtual.setMonth(dataAtual.getMonth() + 1);
      }

      await this.transacaoRepo.createMany(transacoesRecorrentes);

      // Para compras recorrentes, apenas o valor da primeira cobrança afeta o saldo atômico imediato
      if (conta.tipo === 'CartaoCredito') {
        await prisma.contaBancaria.update({
          where: { id: conta.id },
          data: {
            saldo_atual: Number(conta.saldo_atual) + valorNumerico
          }
        });
      } else if (rest.status === 'Pago') {
        let novoSaldo = Number(conta.saldo_atual);
        if (rest.tipo === 'Despesa') {
          novoSaldo -= valorNumerico;
        } else if (rest.tipo === 'Receita') {
          novoSaldo += valorNumerico;
        }
        await prisma.contaBancaria.update({
          where: { id: conta.id },
          data: { saldo_atual: novoSaldo }
        });
      }

      return { message: `${total_parcelas} cobranças recorrentes criadas com sucesso.`, transacao_pai_id };
    }

    // Lógica para parcelamento
    if (total_parcelas > 1) {
      const transacoesParceladas: Prisma.TransacaoUncheckedCreateInput[] = [];
      const transacao_pai_id = uuidv4();
      const valorParcela = valorNumerico / total_parcelas;
      
      let dataAtual = new Date(data_transacao);

      for (let i = 1; i <= total_parcelas; i++) {
        transacoesParceladas.push({
          ...rest,
          usuario_id,
          valor: valorParcela,
          data_transacao: new Date(dataAtual),
          parcela_atual: i,
          total_parcelas,
          transacao_pai_id,
          recorrente: false,
          id: uuidv4()
        });
        
        // Adiciona 1 mês para a próxima parcela
        dataAtual.setMonth(dataAtual.getMonth() + 1);
      }

      await this.transacaoRepo.createMany(transacoesParceladas);

      // Para cartões de crédito parcelados, o valor total da compra afeta o saldo (limite comprometido) imediatamente
      if (conta.tipo === 'CartaoCredito') {
        await prisma.contaBancaria.update({
          where: { id: conta.id },
          data: {
            saldo_atual: Number(conta.saldo_atual) + valorNumerico
          }
        });
      }

      return { message: `${total_parcelas} parcelas criadas com sucesso.`, transacao_pai_id };
    }

    // Transação única
    const transacao = await this.transacaoRepo.create({
      ...rest,
      usuario_id,
      valor: valorNumerico,
      data_transacao: new Date(data_transacao),
      total_parcelas: 1,
      parcela_atual: 1,
      recorrente: isRecorrente
    });

    // Atualiza saldo da conta
    let novoSaldo = Number(conta.saldo_atual);
    if (rest.tipo === 'Despesa') {
      if (conta.tipo === 'CartaoCredito') {
        novoSaldo += valorNumerico; // Aumenta a fatura (dívida) do cartão
      } else if (rest.status === 'Pago') {
        novoSaldo -= valorNumerico; // Diminui o saldo da conta corrente/poupança/dinheiro
      }
    } else if (rest.tipo === 'Receita') {
      if (conta.tipo !== 'CartaoCredito' && rest.status === 'Pago') {
        novoSaldo += valorNumerico; // Aumenta o saldo da conta corrente/poupança/dinheiro
      }
    }

    await prisma.contaBancaria.update({
      where: { id: conta.id },
      data: { saldo_atual: novoSaldo }
    });

    return transacao;
  }

  async listarTransacoes(filtros: any) {
    return this.transacaoRepo.findByFilters({
      usuario_id: filtros.usuario_id,
      mes: filtros.mes ? parseInt(filtros.mes) : undefined,
      ano: filtros.ano ? parseInt(filtros.ano) : undefined,
      conta_id: filtros.conta_id,
      page: filtros.page ? parseInt(filtros.page) : 1,
      limit: filtros.limit ? parseInt(filtros.limit) : 50
    });
  }

  async fecharFatura(usuario_id: string, conta_id: string) {
    // Busca transações pendentes e atualiza para Pago
    const pendentes = await this.transacaoRepo.findPendentesByConta(usuario_id, conta_id);
    
    if (pendentes.length === 0) {
      return { message: "Nenhuma transação pendente para fechar." };
    }

    // Calcula o total da fatura a ser paga
    let totalFatura = 0;
    for (const t of pendentes) {
      const valor = Number(t.valor);
      if (t.tipo === 'Despesa') {
        totalFatura += valor;
      } else if (t.tipo === 'Transferencia') {
        if (t.descricao.includes('[Saída]')) {
          totalFatura += valor;
        } else {
          totalFatura -= valor;
        }
      } else if (t.tipo === 'Receita') {
        totalFatura -= valor;
      }
    }

    const contaCartao = await prisma.contaBancaria.findUnique({
      where: { id: conta_id },
      include: { cartao_detalhe: true }
    });

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
            id: uuidv4()
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
            id: uuidv4()
          }
        });

        // Decrementa o saldo da conta corrente
        await tx.contaBancaria.update({
          where: { id: contaPagamentoId },
          data: { saldo_atual: { decrement: totalFatura } }
        });
      }
    });

    return { message: `Fatura fechada. ${pendentes.length} transações marcadas como pagas.` };
  }

  async toggleStatus(id: string, usuario_id: string) {
    const transacao = await this.transacaoRepo.findById(id);
    if (!transacao || transacao.usuario_id !== usuario_id) {
      throw new Error("Transação não encontrada.");
    }

    const novoStatus = transacao.status === 'Pago' ? 'Pendente' : 'Pago';
    const transacaoAtualizada = await this.transacaoRepo.updateStatus(id, novoStatus);

    // Ajusta o saldo da conta vinculada
    const conta = await prisma.contaBancaria.findUnique({
      where: { id: transacao.conta_id }
    });

    if (conta) {
      const valorNumerico = Number(transacao.valor);
      let novoSaldo = Number(conta.saldo_atual);

      // Se a conta for Cartão de Crédito, mudar Pago/Pendente não afeta o saldo (que é o total gasto na fatura corrente).
      // Mas se for uma conta normal (Corrente, Poupanca, Dinheiro):
      if (conta.tipo !== 'CartaoCredito') {
        if (transacao.tipo === 'Despesa') {
          if (novoStatus === 'Pago') {
            novoSaldo -= valorNumerico; // Mudou de Pendente para Pago: subtrai do saldo
          } else {
            novoSaldo += valorNumerico; // Mudou de Pago para Pendente: devolve para o saldo
          }
        } else if (transacao.tipo === 'Receita') {
          if (novoStatus === 'Pago') {
            novoSaldo += valorNumerico; // Mudou de Pendente para Pago: soma ao saldo
          } else {
            novoSaldo -= valorNumerico; // Mudou de Pago para Pendente: subtrai do saldo
          }
        }

        await prisma.contaBancaria.update({
          where: { id: conta.id },
          data: { saldo_atual: novoSaldo }
        });
      }
    }

    return transacaoAtualizada;
  }

  async importarTransacoes(usuario_id: string, conta_id: string, transacoesData: any[]) {
    // 1. Busca a conta bancária de origem
    const contaOrigem = await prisma.contaBancaria.findUnique({
      where: { id: conta_id }
    });

    if (!contaOrigem || contaOrigem.usuario_id !== usuario_id) {
      throw new Error("Conta bancária de origem não encontrada.");
    }

    // 2. Processa as transações
    const transacoesParaCriar: Prisma.TransacaoUncheckedCreateInput[] = [];
    
    // Mapeamento de deltas de saldo por conta_id
    const saldosDeltas: Record<string, number> = {
      [conta_id]: 0
    };

    for (const t of transacoesData) {
      const valor = Number(t.valor);
      if (isNaN(valor) || valor <= 0) continue;

      const subcategoria_id = t.subcategoria_id || null;
      const status = t.status || 'Pago';
      const tipo = t.tipo || 'Despesa';

      if (tipo === 'Transferencia' && t.conta_destino_id) {
        const conta_destino_id = t.conta_destino_id;
        
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
          total_parcelas: 1
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
          total_parcelas: 1
        });

        // 3. Impacto de saída na conta de origem
        if (contaOrigem.tipo === 'CartaoCredito') {
          saldosDeltas[conta_id] += valor;
        } else {
          saldosDeltas[conta_id] -= valor;
        }

        // 4. Impacto de entrada na conta de destino
        if (!saldosDeltas[conta_destino_id]) {
          saldosDeltas[conta_destino_id] = 0;
        }

        if (contaDestino.tipo === 'CartaoCredito') {
          saldosDeltas[conta_destino_id] -= valor;
        } else {
          saldosDeltas[conta_destino_id] += valor;
        }

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

        // Calcula o impacto no saldo da conta origem
        if (tipo === 'Despesa') {
          if (contaOrigem.tipo === 'CartaoCredito') {
            saldosDeltas[conta_id] += valor;
          } else if (status === 'Pago') {
            saldosDeltas[conta_id] -= valor;
          }
        } else if (tipo === 'Receita') {
          if (contaOrigem.tipo !== 'CartaoCredito' && status === 'Pago') {
            saldosDeltas[conta_id] += valor;
          }
        }
      }
    }

    if (transacoesParaCriar.length === 0) {
      throw new Error("Nenhuma transação válida para importar.");
    }

    // 3. Executa a criação e atualização em lote (transação atômica)
    const count = await prisma.$transaction(async (tx) => {
      // Cria transações
      const createRes = await tx.transacao.createMany({
        data: transacoesParaCriar
      });

      // Atualiza saldos das contas envolvidas
      for (const [cId, delta] of Object.entries(saldosDeltas)) {
        if (delta === 0) continue;
        const c = await tx.contaBancaria.findUnique({
          where: { id: cId }
        });
        if (c) {
          await tx.contaBancaria.update({
            where: { id: cId },
            data: {
              saldo_atual: Number(c.saldo_atual) + delta
            }
          });
        }
      }

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

    let saldoDelta = 0;

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
            saldoDelta -= ofxTr.valor;
          } else if (ofxTr.tipo === 'Receita') {
            saldoDelta += ofxTr.valor;
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
        if (saldoDelta !== 0) {
          await tx.contaBancaria.update({
            where: { id: conta_id },
            data: {
              saldo_atual: Number(conta.saldo_atual) + saldoDelta
            }
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
      const transacaoDestino = await tx.transacao.update({
        where: { id: receita_id },
        data: {
          tipo: 'Transferencia',
          descricao: `[Entrada] ${descricao}`,
          subcategoria_id: null,
          status: 'Pago'
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
          status: 'Pago'
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
      include: { conta: true }
    });

    if (!transacaoExistente || transacaoExistente.usuario_id !== usuario_id) {
      throw new Error("Transação não encontrada.");
    }

    const { conta_id, subcategoria_id, descricao, valor, tipo, data_transacao, status } = data;

    // Busca a nova conta
    const novaConta = await prisma.contaBancaria.findUnique({
      where: { id: conta_id }
    });

    if (!novaConta || novaConta.usuario_id !== usuario_id) {
      throw new Error("Conta bancária de destino não encontrada.");
    }

    const valorNumerico = Number(valor);

    // Identifica se tem uma transação gêmea (outro lado da transferência)
    let twinTransacao: any = null;
    let twinConta: any = null;

    if (transacaoExistente.tipo === 'Transferencia') {
      const isEntrada = transacaoExistente.descricao.startsWith('[Entrada]');
      const isSaida = transacaoExistente.descricao.startsWith('[Saída]');
      
      if (isEntrada || isSaida) {
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
      // --- 1. REVERTE OS SALDOS ANTIGOS ---
      // A. Reverte a transação principal
      let oldSaldoPrincipal = Number(transacaoExistente.conta.saldo_atual);
      if (transacaoExistente.tipo === 'Despesa') {
        if (transacaoExistente.conta.tipo === 'CartaoCredito') {
          oldSaldoPrincipal -= Number(transacaoExistente.valor);
        } else if (transacaoExistente.status === 'Pago') {
          oldSaldoPrincipal += Number(transacaoExistente.valor);
        }
      } else if (transacaoExistente.tipo === 'Receita') {
        if (transacaoExistente.conta.tipo !== 'CartaoCredito' && transacaoExistente.status === 'Pago') {
          oldSaldoPrincipal -= Number(transacaoExistente.valor);
        }
      } else if (transacaoExistente.tipo === 'Transferencia' && transacaoExistente.status === 'Pago') {
        if (transacaoExistente.descricao.includes('[Saída]')) {
          if (transacaoExistente.conta.tipo === 'CartaoCredito') {
            oldSaldoPrincipal -= Number(transacaoExistente.valor);
          } else {
            oldSaldoPrincipal += Number(transacaoExistente.valor);
          }
        } else { // [Entrada]
          if (transacaoExistente.conta.tipo === 'CartaoCredito') {
            oldSaldoPrincipal += Number(transacaoExistente.valor);
          } else {
            oldSaldoPrincipal -= Number(transacaoExistente.valor);
          }
        }
      }

      if (transacaoExistente.conta_id !== conta_id) {
        await tx.contaBancaria.update({
          where: { id: transacaoExistente.conta_id },
          data: { saldo_atual: oldSaldoPrincipal }
        });
      }

      // B. Reverte a transação gêmea (se existir)
      if (twinTransacao && twinTransacao.status === 'Pago') {
        let oldSaldoTwin = Number(twinTransacao.conta.saldo_atual);
        if (twinTransacao.descricao.includes('[Saída]')) {
          if (twinTransacao.conta.tipo === 'CartaoCredito') {
            oldSaldoTwin -= Number(twinTransacao.valor);
          } else {
            oldSaldoTwin += Number(twinTransacao.valor);
          }
        } else { // [Entrada]
          if (twinTransacao.conta.tipo === 'CartaoCredito') {
            oldSaldoTwin += Number(twinTransacao.valor);
          } else {
            oldSaldoTwin -= Number(twinTransacao.valor);
          }
        }
        
        await tx.contaBancaria.update({
          where: { id: twinTransacao.conta_id },
          data: { saldo_atual: oldSaldoTwin }
        });
        
        twinConta = await tx.contaBancaria.findUnique({
          where: { id: twinTransacao.conta_id }
        });
      }

      // --- 2. APLICA OS NOVOS SALDOS ---
      // A. Aplica novo saldo da transação principal
      let baseSaldoNova = transacaoExistente.conta_id === conta_id ? oldSaldoPrincipal : Number(novaConta.saldo_atual);
      let novoSaldoPrincipal = baseSaldoNova;
      
      if (tipo === 'Despesa') {
        if (novaConta.tipo === 'CartaoCredito') {
          novoSaldoPrincipal += valorNumerico;
        } else if (status === 'Pago') {
          novoSaldoPrincipal -= valorNumerico;
        }
      } else if (tipo === 'Receita') {
        if (novaConta.tipo !== 'CartaoCredito' && status === 'Pago') {
          novoSaldoPrincipal += valorNumerico;
        }
      } else if (tipo === 'Transferencia' && status === 'Pago') {
        if (descricao.includes('[Saída]')) {
          if (novaConta.tipo === 'CartaoCredito') {
            novoSaldoPrincipal += valorNumerico;
          } else {
            novoSaldoPrincipal -= valorNumerico;
          }
        } else { // [Entrada]
          if (novaConta.tipo === 'CartaoCredito') {
            novoSaldoPrincipal -= valorNumerico;
          } else {
            novoSaldoPrincipal += valorNumerico;
          }
        }
      }

      await tx.contaBancaria.update({
        where: { id: novaConta.id },
        data: { saldo_atual: novoSaldoPrincipal }
      });

      // B. Aplica novo saldo da transação gêmea (se existir)
      if (twinTransacao && twinConta && status === 'Pago') {
        let novoSaldoTwin = Number(twinConta.saldo_atual);
        const isSaidaTwin = twinTransacao.descricao.includes('[Saída]');
        
        if (isSaidaTwin) {
          if (twinConta.tipo === 'CartaoCredito') {
            novoSaldoTwin += valorNumerico;
          } else {
            novoSaldoTwin -= valorNumerico;
          }
        } else { // [Entrada]
          if (twinConta.tipo === 'CartaoCredito') {
            novoSaldoTwin -= valorNumerico;
          } else {
            novoSaldoTwin += valorNumerico;
          }
        }

        await tx.contaBancaria.update({
          where: { id: twinConta.id },
          data: { saldo_atual: novoSaldoTwin }
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
      return transacaoAtualizada;
    });
  }

  async deletarTransacao(id: string, usuario_id: string) {
    const transacaoExistente = await prisma.transacao.findUnique({
      where: { id },
      include: { conta: true }
    });

    if (!transacaoExistente || transacaoExistente.usuario_id !== usuario_id) {
      throw new Error("Transação não encontrada.");
    }

    // Identifica se tem uma transação gêmea (outro lado da transferência)
    let twinTransacao: any = null;

    if (transacaoExistente.tipo === 'Transferencia') {
      const isEntrada = transacaoExistente.descricao.startsWith('[Entrada]');
      const isSaida = transacaoExistente.descricao.startsWith('[Saída]');
      
      if (isEntrada || isSaida) {
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
      // 1. REVERTE SALDO DA TRANSAÇÃO PRINCIPAL
      let oldSaldoPrincipal = Number(transacaoExistente.conta.saldo_atual);
      if (transacaoExistente.tipo === 'Despesa') {
        if (transacaoExistente.conta.tipo === 'CartaoCredito') {
          oldSaldoPrincipal -= Number(transacaoExistente.valor);
        } else if (transacaoExistente.status === 'Pago') {
          oldSaldoPrincipal += Number(transacaoExistente.valor);
        }
      } else if (transacaoExistente.tipo === 'Receita') {
        if (transacaoExistente.conta.tipo !== 'CartaoCredito' && transacaoExistente.status === 'Pago') {
          oldSaldoPrincipal -= Number(transacaoExistente.valor);
        }
      } else if (transacaoExistente.tipo === 'Transferencia' && transacaoExistente.status === 'Pago') {
        if (transacaoExistente.descricao.includes('[Saída]')) {
          if (transacaoExistente.conta.tipo === 'CartaoCredito') {
            oldSaldoPrincipal -= Number(transacaoExistente.valor);
          } else {
            oldSaldoPrincipal += Number(transacaoExistente.valor);
          }
        } else { // [Entrada]
          if (transacaoExistente.conta.tipo === 'CartaoCredito') {
            oldSaldoPrincipal += Number(transacaoExistente.valor);
          } else {
            oldSaldoPrincipal -= Number(transacaoExistente.valor);
          }
        }
      }

      await tx.contaBancaria.update({
        where: { id: transacaoExistente.conta_id },
        data: { saldo_atual: oldSaldoPrincipal }
      });

      // 2. REVERTE SALDO DA TRANSAÇÃO GÊMEA
      if (twinTransacao && twinTransacao.status === 'Pago') {
        let oldSaldoTwin = Number(twinTransacao.conta.saldo_atual);
        if (twinTransacao.descricao.includes('[Saída]')) {
          if (twinTransacao.conta.tipo === 'CartaoCredito') {
            oldSaldoTwin -= Number(twinTransacao.valor);
          } else {
            oldSaldoTwin += Number(twinTransacao.valor);
          }
        } else { // [Entrada]
          if (twinTransacao.conta.tipo === 'CartaoCredito') {
            oldSaldoTwin += Number(twinTransacao.valor);
          } else {
            oldSaldoTwin -= Number(twinTransacao.valor);
          }
        }

        await tx.contaBancaria.update({
          where: { id: twinTransacao.conta_id },
          data: { saldo_atual: oldSaldoTwin }
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

        let twinTransacao: any = null;
        if (transacao.tipo === 'Transferencia') {
          const isEntrada = transacao.descricao.startsWith('[Entrada]');
          const isSaida = transacao.descricao.startsWith('[Saída]');

          if (isEntrada || isSaida) {
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

        let oldSaldoPrincipal = Number(contaPrincipal.saldo_atual);
        if (transacao.tipo === 'Despesa') {
          if (contaPrincipal.tipo === 'CartaoCredito') {
            oldSaldoPrincipal -= Number(transacao.valor);
          } else if (transacao.status === 'Pago') {
            oldSaldoPrincipal += Number(transacao.valor);
          }
        } else if (transacao.tipo === 'Receita') {
          if (contaPrincipal.tipo !== 'CartaoCredito' && transacao.status === 'Pago') {
            oldSaldoPrincipal -= Number(transacao.valor);
          }
        } else if (transacao.tipo === 'Transferencia' && transacao.status === 'Pago') {
          if (transacao.descricao.includes('[Saída]')) {
            if (contaPrincipal.tipo === 'CartaoCredito') {
              oldSaldoPrincipal -= Number(transacao.valor);
            } else {
              oldSaldoPrincipal += Number(transacao.valor);
            }
          } else { // [Entrada]
            if (contaPrincipal.tipo === 'CartaoCredito') {
              oldSaldoPrincipal += Number(transacao.valor);
            } else {
              oldSaldoPrincipal -= Number(transacao.valor);
            }
          }
        }

        await tx.contaBancaria.update({
          where: { id: transacao.conta_id },
          data: { saldo_atual: oldSaldoPrincipal }
        });

        // 2. REVERTE SALDO DA TRANSAÇÃO GÊMEA
        if (twinTransacao && twinTransacao.status === 'Pago') {
          const contaTwin = await tx.contaBancaria.findUnique({
            where: { id: twinTransacao.conta_id }
          });
          if (!contaTwin) {
            throw new Error(`Conta gêmea ${twinTransacao.conta_id} não encontrada.`);
          }

          let oldSaldoTwin = Number(contaTwin.saldo_atual);
          if (twinTransacao.descricao.includes('[Saída]')) {
            if (contaTwin.tipo === 'CartaoCredito') {
              oldSaldoTwin -= Number(twinTransacao.valor);
            } else {
              oldSaldoTwin += Number(twinTransacao.valor);
            }
          } else { // [Entrada]
            if (contaTwin.tipo === 'CartaoCredito') {
              oldSaldoTwin += Number(twinTransacao.valor);
            } else {
              oldSaldoTwin -= Number(twinTransacao.valor);
            }
          }

          await tx.contaBancaria.update({
            where: { id: twinTransacao.conta_id },
            data: { saldo_atual: oldSaldoTwin }
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

    // 1. Busca todas as transações da recorrência
    const transacoes = await prisma.transacao.findMany({
      where: {
        transacao_pai_id,
        usuario_id
      },
      orderBy: { data_transacao: 'asc' }
    });

    if (transacoes.length === 0) {
      throw new Error("Recorrência não encontrada.");
    }

    const totalExistente = transacoes.length;
    const novosTotal = totalExistente + novos_meses;

    // 2. A última transação na série
    const ultima = transacoes[transacoes.length - 1];

    // 3. Modifica as transações existentes para terem o novo total_parcelas
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

      // 4. Cria os novos meses futuros de recorrência
      const novasTransacoes: Prisma.TransacaoUncheckedCreateInput[] = [];
      let dataAtual = new Date(ultima.data_transacao);

      for (let i = 1; i <= novos_meses; i++) {
        // Adiciona 1 mês para cada nova recorrência relativa à última
        dataAtual.setMonth(dataAtual.getMonth() + 1);

        novasTransacoes.push({
          usuario_id,
          conta_id: ultima.conta_id,
          subcategoria_id: ultima.subcategoria_id,
          descricao: ultima.descricao,
          valor: ultima.valor, // valor cheio da mensalidade
          tipo: ultima.tipo,
          data_transacao: new Date(dataAtual),
          status: 'Pendente', // Novas parcelas começam pendentes
          parcela_atual: totalExistente + i,
          total_parcelas: novosTotal,
          transacao_pai_id,
          recorrente: true,
          id: uuidv4()
        } as any);
      }

      await tx.transacao.createMany({
        data: novasTransacoes
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

    // 1. Busca todas as transações da recorrência
    const transacoes = await prisma.transacao.findMany({
      where: {
        transacao_pai_id,
        usuario_id
      },
      orderBy: { parcela_atual: 'asc' }
    });

    if (transacoes.length === 0) {
      throw new Error("Recorrência não encontrada.");
    }

    // 2. Modifica transações em uma transação de banco (Prisma transaction)
    return prisma.$transaction(async (tx) => {
      // Deleta todas as parcelas futuras após a parcela_limite
      const deleteResult = await tx.transacao.deleteMany({
        where: {
          transacao_pai_id,
          usuario_id,
          parcela_atual: {
            gt: parcela_limite
          }
        }
      });

      // Atualiza as parcelas restantes para refletirem o novo total_parcelas
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

      return {
        message: `Assinatura encerrada antecipadamente no mês ${parcela_limite}. ${deleteResult.count} cobranças futuras foram removidas com sucesso.`,
        novoTotal: parcela_limite
      };
    });
  }
}

