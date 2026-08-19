import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export class VeiculoUsuarioController {
  list = async (req: Request, res: Response) => res.json(await prisma.userVehicle.findMany({ where: { usuario_id: req.usuario_id!, ativo: true }, orderBy: { nome: 'asc' } }));
  create = async (req: Request, res: Response) => res.status(201).json(await prisma.userVehicle.create({ data: { usuario_id: req.usuario_id!, ...req.body } }));
  update = async (req: Request, res: Response) => {
    const updated = await prisma.userVehicle.updateMany({ where: { id: req.params.id, usuario_id: req.usuario_id! }, data: req.body });
    if (!updated.count) return res.status(404).json({ message: 'Veículo não encontrado.' });
    return res.json(await prisma.userVehicle.findUnique({ where: { id: req.params.id } }));
  };
  remove = async (req: Request, res: Response) => {
    const updated = await prisma.userVehicle.updateMany({ where: { id: req.params.id, usuario_id: req.usuario_id! }, data: { ativo: false } });
    return updated.count ? res.status(204).send() : res.status(404).json({ message: 'Veículo não encontrado.' });
  };
}
