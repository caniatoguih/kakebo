import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import prisma from '../lib/prisma';
import { calculateSalary } from '../domain/finance/salaryCalculator';
import { isSalaryCompetenceInRange, salaryLaunchDate } from '../domain/finance/salaryLaunch';
import { assertAccountOwnership, assertSubcategoryOwnership } from '../services/OwnershipService';

const toInput = (planning: any) => ({
  ano: planning.ano, salarioBase: Number(planning.salario_base), descontosMensais: Number(planning.descontos_mensais),
  dependentes: planning.dependentes, melhorDeducaoIrrf: planning.melhor_deducao_irrf,
  pagamentoFolha: planning.pagamento_folha, estimarDezembroAnterior: planning.estimar_dezembro_anterior,
  incluirDecimoTerceiro: planning.incluir_decimo_terceiro, avosDecimoTerceiro: planning.avos_decimo_terceiro,
  modoDecimoTerceiro: planning.modo_decimo_terceiro, mesPrimeiraParcela13: planning.mes_primeira_parcela_13,
  mesSegundaParcela13: planning.mes_segunda_parcela_13,
  ferias: planning.ferias.map((item: any) => ({ inicio: item.inicio.toISOString().slice(0, 10), fim: item.fim.toISOString().slice(0, 10) })),
  bonus: planning.bonus.map((item: any) => ({ mes: item.mes, valor: Number(item.valor), incideInss: item.incide_inss, incideIrrf: item.incide_irrf })),
});

const serialize = (planning: any) => ({
  ...planning, salario_base: Number(planning.salario_base), descontos_mensais: Number(planning.descontos_mensais),
  vale_alimentacao: Number(planning.vale_alimentacao), odontologico: Number(planning.odontologico),
  assistencia_medica: Number(planning.assistencia_medica), outros_descontos: Number(planning.outros_descontos),
  bonus: planning.bonus?.map((item: any) => ({ ...item, valor: Number(item.valor) })),
  lancamentos: planning.lancamentos?.map((item: any) => ({ ...item, valor: Number(item.valor) })),
});

const planningData = (body: any) => ({
  empresa: body.empresa,
  ano: body.ano,
  salario_base: body.salario_base,
  conta_id: body.conta_id,
  subcategoria_id: body.subcategoria_id,
  pagamento_folha: body.pagamento_folha,
  estimar_dezembro_anterior: body.estimar_dezembro_anterior,
  incluir_decimo_terceiro: body.incluir_decimo_terceiro,
  avos_decimo_terceiro: body.avos_decimo_terceiro,
  modo_decimo_terceiro: body.modo_decimo_terceiro,
  mes_primeira_parcela_13: body.mes_primeira_parcela_13,
  mes_segunda_parcela_13: body.mes_segunda_parcela_13,
  descontos_mensais: body.vale_alimentacao + body.odontologico + body.assistencia_medica + body.outros_descontos,
  vale_alimentacao: body.vale_alimentacao,
  odontologico: body.odontologico,
  assistencia_medica: body.assistencia_medica,
  outros_descontos: body.outros_descontos,
  dependentes: body.dependentes,
  melhor_deducao_irrf: body.melhor_deducao_irrf,
});

const bodyToCalculationInput = (body: any) => ({
  ano: body.ano,
  salarioBase: body.salario_base,
  descontosMensais: body.vale_alimentacao + body.odontologico + body.assistencia_medica + body.outros_descontos,
  dependentes: body.dependentes,
  melhorDeducaoIrrf: body.melhor_deducao_irrf,
  pagamentoFolha: body.pagamento_folha,
  estimarDezembroAnterior: body.estimar_dezembro_anterior,
  incluirDecimoTerceiro: body.incluir_decimo_terceiro,
  avosDecimoTerceiro: body.avos_decimo_terceiro,
  modoDecimoTerceiro: body.modo_decimo_terceiro,
  mesPrimeiraParcela13: body.mes_primeira_parcela_13,
  mesSegundaParcela13: body.mes_segunda_parcela_13,
  ferias: body.ferias,
  bonus: body.bonus.map((bonus: any) => ({ mes: bonus.mes, valor: bonus.valor, incideInss: bonus.incide_inss, incideIrrf: bonus.incide_irrf })),
});

async function validateDestinations(contaId: string, subcategoriaId: string, usuarioId: string) {
  await assertAccountOwnership(contaId, usuarioId);
  const subcategoria = await assertSubcategoryOwnership(subcategoriaId, usuarioId);
  const withCategory = await prisma.subcategoria.findUnique({ where: { id: subcategoriaId }, include: { categoria: true } });
  if (!subcategoria || !withCategory || withCategory.categoria.tipo !== 'Receita') throw new Error('Escolha uma subcategoria de receita.');
}

export class PlanejamentoSalarialController {
  list = async (req: Request, res: Response) => {
    const items = await prisma.planejamentoSalarial.findMany({
      where: { usuario_id: req.usuario_id! }, include: { ferias: true, bonus: true, lancamentos: { include: { transacao: { select: { status: true } } } } }, orderBy: [{ ano: 'desc' }, { created_at: 'desc' }],
    });
    return res.json(items.map(serialize));
  };

  get = async (req: Request, res: Response) => {
    const item = await prisma.planejamentoSalarial.findFirst({ where: { id: req.params.id, usuario_id: req.usuario_id! }, include: { ferias: true, bonus: true, lancamentos: { include: { transacao: true } } } });
    if (!item) return res.status(404).json({ message: 'Planejamento salarial não encontrado.' });
    return res.json(serialize(item));
  };

  create = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const body = req.body;
    calculateSalary(bodyToCalculationInput(body));
    await validateDestinations(body.conta_id, body.subcategoria_id, usuario_id);
    const item = await prisma.planejamentoSalarial.create({ data: {
      usuario_id, ...planningData(body),
      ferias: { create: body.ferias.map((item: any) => ({ inicio: new Date(`${item.inicio}T12:00:00Z`), fim: new Date(`${item.fim}T12:00:00Z`) })) },
      bonus: { create: body.bonus.map((item: any) => ({ mes: item.mes, valor: item.valor, incide_inss: item.incide_inss ?? false, incide_irrf: item.incide_irrf ?? true })) },
    }, include: { ferias: true, bonus: true, lancamentos: true } });
    return res.status(201).json(serialize(item));
  };

  update = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const existing = await prisma.planejamentoSalarial.findFirst({ where: { id: req.params.id, usuario_id } });
    if (!existing) return res.status(404).json({ message: 'Planejamento salarial não encontrado.' });
    calculateSalary(bodyToCalculationInput(req.body));
    await validateDestinations(req.body.conta_id, req.body.subcategoria_id, usuario_id);
    const item = await prisma.$transaction(async (tx) => {
      await tx.planejamentoSalarialFerias.deleteMany({ where: { planejamento_id: existing.id } });
      await tx.planejamentoSalarialBonus.deleteMany({ where: { planejamento_id: existing.id } });
      return tx.planejamentoSalarial.update({
        where: { id: existing.id },
        data: {
          ...planningData(req.body),
          ferias: { create: req.body.ferias.map((vacation: any) => ({ inicio: new Date(`${vacation.inicio}T12:00:00Z`), fim: new Date(`${vacation.fim}T12:00:00Z`) })) },
          bonus: { create: req.body.bonus.map((bonus: any) => ({ mes: bonus.mes, valor: bonus.valor, incide_inss: bonus.incide_inss ?? false, incide_irrf: bonus.incide_irrf ?? true })) },
        },
        include: { ferias: true, bonus: true, lancamentos: true },
      });
    });
    return res.json(serialize(item));
  };

  delete = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const item = await prisma.planejamentoSalarial.findFirst({
      where: { id: req.params.id, usuario_id }, include: { lancamentos: { include: { transacao: true } } },
    });
    if (!item) return res.status(404).json({ message: 'Planejamento salarial não encontrado.' });
    const pendingIds = item.lancamentos.filter((link) => link.transacao.status === 'Pendente').map((link) => link.transacao_id);
    const paidCount = item.lancamentos.length - pendingIds.length;
    await prisma.$transaction(async (tx) => {
      if (pendingIds.length) await tx.transacao.deleteMany({ where: { id: { in: pendingIds }, usuario_id, status: 'Pendente' } });
      await tx.planejamentoSalarial.delete({ where: { id: item.id } });
    });
    return res.json({ message: 'Planejamento salarial excluído.', lancamentos_pendentes_removidos: pendingIds.length, lancamentos_pagos_preservados: paidCount });
  };

  calculate = async (req: Request, res: Response) => {
    const item = await prisma.planejamentoSalarial.findFirst({ where: { id: req.params.id, usuario_id: req.usuario_id! }, include: { ferias: true, bonus: true } });
    if (!item) return res.status(404).json({ message: 'Planejamento salarial não encontrado.' });
    return res.json(calculateSalary(toInput(item)));
  };

  launch = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const item = await prisma.planejamentoSalarial.findFirst({ where: { id: req.params.id, usuario_id: req.usuario_id! }, include: { ferias: true, bonus: true, lancamentos: { include: { transacao: true } } } });
    if (!item) return res.status(404).json({ message: 'Planejamento salarial não encontrado.' });
    const initialCompetence = req.body.competencia_inicial ?? `${item.ano}-01`;
    const finalCompetence = req.body.competencia_final ?? `${item.ano}-12`;
    const launchDay = req.body.dia_lancamento ?? 15;
    if (!initialCompetence.startsWith(`${item.ano}-`) || !finalCompetence.startsWith(`${item.ano}-`)) {
      return res.status(400).json({ message: `O intervalo deve pertencer ao ano ${item.ano} do planejamento.` });
    }
    const result = calculateSalary(toInput(item));
    const generated: Array<{ competencia: string; tipo_evento: string; valor: number; descricao: string; data: Date }> = [];
    result.recebimentos.forEach((month) => {
      if (!isSalaryCompetenceInRange(month.competencia, initialCompetence, finalCompetence)) return;
      const date = salaryLaunchDate(month.competencia, launchDay);
      if (month.folha > 0) generated.push({ competencia: month.competencia, tipo_evento: 'folha', valor: month.folha, descricao: `Salário — ${item.empresa} — recebimento ${month.competencia} — ${month.origemFolha ? `competência ${month.origemFolha}` : 'sem folha'}`, data: date });
      if (month.reciboFerias > 0) generated.push({ competencia: month.competencia, tipo_evento: 'ferias', valor: month.reciboFerias, descricao: `Férias + 1/3 — ${item.empresa} — recebimento ${month.competencia}`, data: date });
      if (month.decimoTerceiro > 0) generated.push({ competencia: month.competencia, tipo_evento: 'decimo-terceiro', valor: month.decimoTerceiro, descricao: `13º salário — ${item.empresa} — recebimento ${month.competencia}`, data: date });
    });
    const generatedKeys = new Set(generated.map((entry) => `${entry.competencia}:${entry.tipo_evento}`));
    const paid = new Set(item.lancamentos.filter((link: any) => link.transacao.status === 'Pago'
      && isSalaryCompetenceInRange(link.competencia, initialCompetence, finalCompetence))
      .map((link: any) => `${link.competencia}:${link.tipo_evento}`));
    const stalePending = item.lancamentos.filter((link: any) => link.transacao.status === 'Pendente'
      && isSalaryCompetenceInRange(link.competencia, initialCompetence, finalCompetence)
      && !generatedKeys.has(`${link.competencia}:${link.tipo_evento}`));
    const saved = await prisma.$transaction(async (tx) => {
      const output = [];
      if (stalePending.length) {
        await tx.transacao.deleteMany({ where: { id: { in: stalePending.map((link: any) => link.transacao_id) }, usuario_id, status: 'Pendente' } });
      }
      for (const entry of generated) {
        const key = `${entry.competencia}:${entry.tipo_evento}`;
        if (paid.has(key)) continue;
        const existing = item.lancamentos.find((link: any) => link.competencia === entry.competencia && link.tipo_evento === entry.tipo_evento);
        let transaction;
        if (existing) {
          transaction = await tx.transacao.update({ where: { id: existing.transacao_id }, data: { valor: entry.valor, descricao: entry.descricao, data_transacao: entry.data, conta_id: item.conta_id, subcategoria_id: item.subcategoria_id } });
          await tx.planejamentoSalarialLancamento.update({ where: { id: existing.id }, data: { valor: entry.valor } });
        } else {
          transaction = await tx.transacao.create({ data: { id: randomUUID(), usuario_id, conta_id: item.conta_id, subcategoria_id: item.subcategoria_id, descricao: entry.descricao, valor: entry.valor, tipo: 'Receita', data_transacao: entry.data, status: 'Pendente' } });
          await tx.planejamentoSalarialLancamento.create({ data: { planejamento_id: item.id, transacao_id: transaction.id, competencia: entry.competencia, tipo_evento: entry.tipo_evento, valor: entry.valor } });
        }
        output.push(transaction);
      }
      return output;
    });
    return res.json({
      message: `${saved.length} lançamento(s) salarial(is) reconciliado(s).`,
      transacoes: saved,
      removidos_pendentes: stalePending.length,
      ignorados_pago: paid.size,
      intervalo: { competencia_inicial: initialCompetence, competencia_final: finalCompetence, dia_lancamento: launchDay },
    });
  };
}
