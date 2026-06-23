import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';

export class AuthController {
  login = async (req: Request, res: Response) => {
    const { email, senha } = req.body;

    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (!usuario) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaCorreta) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const secret = process.env.JWT_SECRET || 'secret';
    const token = jwt.sign({ id: usuario.id }, secret, { expiresIn: '1d' });

    return res.json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      },
      token
    });
  };

  me = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id: usuario_id },
        select: { id: true, nome: true, email: true }
      });
      if (!usuario) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }
      return res.json(usuario);
    } catch (error: any) {
      return res.status(500).json({ message: 'Erro ao buscar perfil do usuário.' });
    }
  };

  register = async (req: Request, res: Response) => {
    const { nome, email, senha } = req.body;

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) {
      return res.status(400).json({ message: 'E-mail já cadastrado.' });
    }

    const senha_hash = await bcrypt.hash(senha, 8);

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha_hash
      }
    });

    const secret = process.env.JWT_SECRET || 'secret';
    const token = jwt.sign({ id: usuario.id }, secret, { expiresIn: '1d' });

    return res.status(201).json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      },
      token
    });
  };
}
