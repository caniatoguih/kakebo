import { Request, Response } from 'express';
import { NotificacaoService } from '../services/NotificacaoService';

export class NotificacaoController {
  private notificacaoService = new NotificacaoService();

  contasAPagar = async (req: Request, res: Response) => {
    const dias = Number(req.query.dias ?? 3);
    const lembretes = await this.notificacaoService.listarContasAPagar(req.usuario_id!, dias);
    return res.json({ lembretes });
  };
}
