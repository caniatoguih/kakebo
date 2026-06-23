import { Request, Response } from 'express';
import prisma from '../lib/prisma';

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

  // O pagamento ocorre sempre no mês seguinte (+1 mês)
  month += 1;
  if (month > 11) {
    month = 0;
    year += 1;
  }

  return { month, year };
}

export class OrcamentoController {
  list = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const mes = parseInt(req.query.mes as string);
    const ano = parseInt(req.query.ano as string);

    if (isNaN(mes) || isNaN(ano)) {
      return res.status(400).json({ message: 'Parâmetros "mes" e "ano" são obrigatórios.' });
    }

    try {
      const orcamentos = await prisma.orcamento.findMany({
        where: { usuario_id, mes, ano },
        include: {
          subcategoria: {
            include: { categoria: true },
          },
        },
      });

      // Para cada orçamento, calcula o valor realizado considerando faturamento de cartões e calendário para contas normais
      const allSubcatIds = orcamentos
        .map((o) => o.subcategoria_id)
        .filter((id): id is string => id !== null);

      // Busca todas as transações Pago de Despesa do usuário que têm subcategoria correspondente
      const transacoes = await prisma.transacao.findMany({
        where: {
          usuario_id,
          status: 'Pago',
          tipo: 'Despesa',
          subcategoria_id: { in: allSubcatIds }
        },
        include: {
          conta: {
            include: {
              cartao_detalhe: true
            }
          }
        }
      });

      const realizadoMap = new Map<string, number>();
      const targetMonthIndex = mes - 1; // 0-indexed

      for (const t of transacoes) {
        if (!t.subcategoria_id) continue;

        let pertenceAoMes = false;
        if (t.conta?.tipo === 'CartaoCredito' && t.conta.cartao_detalhe) {
          const diaFechamento = t.conta.cartao_detalhe.dia_fechamento;
          const { month, year } = getPaymentMonthAndYear(t.data_transacao, diaFechamento);
          if (month === targetMonthIndex && year === ano) {
            pertenceAoMes = true;
          }
        } else {
          const d = new Date(t.data_transacao);
          const tMes = d.getUTCMonth();
          const tAno = d.getUTCFullYear();
          if (tMes === targetMonthIndex && tAno === ano) {
            pertenceAoMes = true;
          }
        }

        if (pertenceAoMes) {
          const valor = Number(t.valor);
          realizadoMap.set(t.subcategoria_id, (realizadoMap.get(t.subcategoria_id) || 0) + valor);
        }
      }

      const result = orcamentos.map((o) => ({
        id: o.id,
        subcategoria_id: o.subcategoria_id,
        subcategoria_nome: o.subcategoria.nome,
        categoria_id: o.subcategoria.categoria_id,
        categoria_nome: o.subcategoria.categoria.nome,
        pilar: o.subcategoria.categoria.pilar,
        valor_orcado: Number(o.valor_orcado),
        valor_realizado: realizadoMap.get(o.subcategoria_id) ?? 0,
        mes: o.mes,
        ano: o.ano,
      }));

      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ message: 'Erro ao listar orçamentos', error: error.message });
    }
  };

  upsert = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { subcategoria_id, mes, ano, valor_orcado } = req.body;

    if (!subcategoria_id || !mes || !ano || valor_orcado === undefined) {
      return res.status(400).json({ message: 'Campos obrigatórios: subcategoria_id, mes, ano, valor_orcado.' });
    }

    try {
      const orcamento = await prisma.orcamento.upsert({
        where: {
          // Composite unique não está no schema ainda; usamos findFirst + create/update
          // Workaround: usar um id fictício que nunca vai existir para forçar create
          id: 'nonexistent',
        },
        update: {},
        create: {
          usuario_id,
          subcategoria_id,
          mes,
          ano,
          valor_orcado,
        },
      });
      return res.status(201).json(orcamento);
    } catch {
      // Fallback: findFirst + create ou update manual
      try {
        const existing = await prisma.orcamento.findFirst({
          where: { usuario_id, subcategoria_id, mes, ano },
        });

        if (existing) {
          const updated = await prisma.orcamento.update({
            where: { id: existing.id },
            data: { valor_orcado },
          });
          return res.json(updated);
        }

        const created = await prisma.orcamento.create({
          data: { usuario_id, subcategoria_id, mes, ano, valor_orcado },
        });
        return res.status(201).json(created);
      } catch (error: any) {
        return res.status(400).json({ message: 'Erro ao salvar orçamento', error: error.message });
      }
    }
  };

  delete = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { id } = req.params;

    try {
      const orcamento = await prisma.orcamento.findFirst({ where: { id, usuario_id } });
      if (!orcamento) {
        return res.status(404).json({ message: 'Orçamento não encontrado.' });
      }
      await prisma.orcamento.delete({ where: { id } });
      return res.status(204).send();
    } catch (error: any) {
      return res.status(400).json({ message: 'Erro ao excluir orçamento', error: error.message });
    }
  };

  upsertBatch = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: 'O campo "items" deve ser um array.' });
    }

    try {
      const results = [];
      for (const item of items) {
        const { subcategoria_id, mes, ano, valor_orcado } = item;
        if (!subcategoria_id || !mes || !ano || valor_orcado === undefined) {
          continue;
        }

        const existing = await prisma.orcamento.findFirst({
          where: { usuario_id, subcategoria_id, mes, ano },
        });

        if (existing) {
          const updated = await prisma.orcamento.update({
            where: { id: existing.id },
            data: { valor_orcado },
          });
          results.push(updated);
        } else {
          const created = await prisma.orcamento.create({
            data: { usuario_id, subcategoria_id, mes, ano, valor_orcado },
          });
          results.push(created);
        }
      }
      return res.status(200).json(results);
    } catch (error: any) {
      return res.status(500).json({ message: 'Erro ao salvar orçamentos em lote', error: error.message });
    }
  };
}
