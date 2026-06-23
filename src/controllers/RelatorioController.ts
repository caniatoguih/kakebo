import { Request, Response } from 'express';
import { RelatorioService } from '../services/RelatorioService';

export class RelatorioController {
  private relatorioService = new RelatorioService();

  painelReflexao = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const mes = parseInt(req.query.mes as string);
    const ano = parseInt(req.query.ano as string);

    if (!mes || !ano) {
      return res.status(400).json({ message: "mes e ano são obrigatórios." });
    }

    const relatorio = await this.relatorioService.gerarPainelReflexao(usuario_id, mes, ano);
    return res.json(relatorio);
  };

  fluxoContabil = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const inicio = req.query.inicio as string;
    const fim = req.query.fim as string;
    const status = req.query.status as string || 'Pago';
    const conta_id = req.query.conta_id as string || undefined;

    if (!inicio || !fim) {
      return res.status(400).json({ message: "Parâmetros 'inicio' e 'fim' (formato YYYY-MM) são obrigatórios." });
    }

    try {
      const relatorio = await this.relatorioService.gerarFluxoContabil(usuario_id, inicio, fim, status, conta_id);
      return res.json(relatorio);
    } catch (error: any) {
      return res.status(500).json({ message: 'Erro ao gerar fluxo contábil', error: error.message });
    }
  };
}
