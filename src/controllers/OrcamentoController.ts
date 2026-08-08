import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { assertSubcategoryOwnership } from '../services/OwnershipService';

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
      const start = new Date(Date.UTC(ano, mes - 1, 1));
      const end = new Date(Date.UTC(ano, mes, 1));

      // Busca todas as transações Pago de Despesa do usuário que têm subcategoria correspondente
      const transacoes = await prisma.transacao.findMany({
        where: {
          usuario_id,
          status: 'Pago',
          tipo: 'Despesa',
          subcategoria_id: { in: allSubcatIds },
          OR: [
            {
              conta: { tipo: { not: 'CartaoCredito' } },
              data_transacao: { gte: start, lt: end },
            },
            {
              conta: { tipo: 'CartaoCredito' },
              fatura: { data_vencimento: { gte: start, lt: end } },
            },
            {
              conta: { tipo: 'CartaoCredito' },
              fatura_id: null,
              data_transacao: { gte: start, lt: end },
            },
          ],
        },
      });

      const realizadoMap = new Map<string, number>();

      for (const t of transacoes) {
        if (!t.subcategoria_id) continue;
        const valor = Number(t.valor);
        realizadoMap.set(t.subcategoria_id, (realizadoMap.get(t.subcategoria_id) || 0) + valor);
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
      await assertSubcategoryOwnership(subcategoria_id, usuario_id);
      const saved = await prisma.orcamento.upsert({
        where: {
          usuario_id_subcategoria_id_mes_ano: { usuario_id, subcategoria_id, mes, ano },
        },
        update: { valor_orcado },
        create: { usuario_id, subcategoria_id, mes, ano, valor_orcado },
      });
      return res.json(saved);
    } catch (error: any) {
      return res.status(400).json({ message: 'Erro ao salvar orçamento', error: error.message });
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
      const subcategoriasIds = [...new Set(items.map((item: any) => item.subcategoria_id))] as string[];
      for (const subcategoriaId of subcategoriasIds) {
        await assertSubcategoryOwnership(subcategoriaId, usuario_id);
      }
      const validItems = items.filter((item: any) =>
        item.subcategoria_id && item.mes && item.ano && item.valor_orcado !== undefined,
      );
      const results = await prisma.$transaction(validItems.map((item: any) => {
        const { subcategoria_id, mes, ano, valor_orcado } = item;
        return prisma.orcamento.upsert({
          where: {
            usuario_id_subcategoria_id_mes_ano: { usuario_id, subcategoria_id, mes, ano },
          },
          update: { valor_orcado },
          create: { usuario_id, subcategoria_id, mes, ano, valor_orcado },
        });
      }));
      return res.status(200).json(results);
    } catch (error: any) {
      return res.status(500).json({ message: 'Erro ao salvar orçamentos em lote', error: error.message });
    }
  };
}
