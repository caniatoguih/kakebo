import { Request, Response } from 'express';
import { RecorrenciaService, RecurrenceOperationError } from '../services/RecorrenciaService';

export class RecorrenciaController {
  private service = new RecorrenciaService();

  list = async (req: Request, res: Response) => {
    const result = await this.service.list(req.usuario_id!, req.query as any);
    return res.json(result);
  };

  detail = async (req: Request, res: Response) => {
    const result = await this.service.detail(req.usuario_id!, req.params.id);
    if (!result) return res.status(404).json({ message: 'Recorrência não encontrada.' });
    return res.json(result);
  };

  simulateChange = async (req: Request, res: Response) => {
    const result = await this.service.simulateChange(req.usuario_id!, req.params.id, req.body);
    if (!result) return res.status(404).json({ message: 'Recorrência não encontrada.' });
    return res.json(result);
  };

  executeChange = async (req: Request, res: Response) => {
    try {
      const result = await this.service.executeChange(req.usuario_id!, req.params.id, req.body);
      return res.json(result);
    } catch (error) {
      if (error instanceof RecurrenceOperationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      throw error;
    }
  };
}
