import { Request, Response } from 'express';
import { TransacaoService } from '../services/TransacaoService';

export class TransacaoController {
  private transacaoService = new TransacaoService();

  create = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const transacao = await this.transacaoService.criarTransacao(req.body, usuario_id);
    return res.status(201).json(transacao);
  };

  list = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const result = await this.transacaoService.listarTransacoes({
      usuario_id,
      ...req.query
    });
    return res.json(result);
  };

  fecharFatura = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { conta_id } = req.body;
    
    if (!conta_id) {
      return res.status(400).json({ message: "conta_id é obrigatório." });
    }

    const result = await this.transacaoService.fecharFatura(usuario_id, conta_id);
    return res.json(result);
  };

  toggleStatus = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { id } = req.params;

    try {
      const transacao = await this.transacaoService.toggleStatus(id, usuario_id);
      return res.json(transacao);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  importar = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { conta_id, transacoes } = req.body;

    if (!conta_id || !Array.isArray(transacoes)) {
      return res.status(400).json({ message: "conta_id e transacoes (array) são obrigatórios." });
    }

    try {
      const result = await this.transacaoService.importarTransacoes(usuario_id, conta_id, transacoes);
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  conciliarOFX = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { conta_id, ofxText } = req.body;

    if (!conta_id || !ofxText) {
      return res.status(400).json({ message: "conta_id e ofxText são obrigatórios." });
    }

    try {
      const result = await this.transacaoService.conciliarOFX(usuario_id, conta_id, ofxText);
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  converterParaTransferencia = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { conta_origem_id, receita_id, descricao, data_transacao, valor } = req.body;

    if (!conta_origem_id || !receita_id || !descricao || !data_transacao || valor === undefined) {
      return res.status(400).json({ message: "Todos os campos (conta_origem_id, receita_id, descricao, data_transacao, valor) são obrigatórios." });
    }

    try {
      const result = await this.transacaoService.converterParaTransferencia(
        usuario_id,
        conta_origem_id,
        receita_id,
        descricao,
        new Date(data_transacao),
        Number(valor)
      );
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  conciliarOFXBatch = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { statements } = req.body;

    if (!statements || !Array.isArray(statements) || statements.length === 0) {
      return res.status(400).json({ message: "O campo 'statements' é obrigatório e deve ser um array não vazio." });
    }

    for (const stmt of statements) {
      if (!stmt.conta_id || !stmt.ofxText) {
        return res.status(400).json({ message: "Cada item de statement deve conter 'conta_id' e 'ofxText'." });
      }
    }

    try {
      const result = await this.transacaoService.conciliarOFXBatch(usuario_id, statements);
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  update = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { id } = req.params;

    try {
      const transacao = await this.transacaoService.editarTransacao(id, req.body, usuario_id);
      return res.json(transacao);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  delete = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { id } = req.params;

    try {
      const result = await this.transacaoService.deletarTransacao(id, usuario_id);
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  deleteBatch = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "O array de ids é obrigatório e não pode ser vazio." });
    }

    try {
      const result = await this.transacaoService.deletarTransacoesEmLote(ids, usuario_id);
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  prorrogarRecorrencia = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { transacao_pai_id, novos_meses } = req.body;

    if (!transacao_pai_id || !novos_meses) {
      return res.status(400).json({ message: "transacao_pai_id e novos_meses são obrigatórios." });
    }

    try {
      const result = await this.transacaoService.prorrogarRecorrencia(
        transacao_pai_id,
        Number(novos_meses),
        usuario_id
      );
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  cancelarRecorrencia = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { transacao_pai_id, parcela_limite } = req.body;

    if (!transacao_pai_id || !parcela_limite) {
      return res.status(400).json({ message: "transacao_pai_id e parcela_limite são obrigatórios." });
    }

    try {
      const result = await this.transacaoService.cancelarRecorrencia(
        transacao_pai_id,
        Number(parcela_limite),
        usuario_id
      );
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };
}

