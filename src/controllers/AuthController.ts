import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { getJwtSecret } from '../config/security';
import { clearSessionCookies, setSessionCookies } from '../utils/cookies';
import { logger } from '../utils/logger';
import { sendPasswordResetEmail } from '../services/EmailService';
import {
  createPasswordResetToken,
  discardPasswordResetToken,
  resetPasswordWithToken,
} from '../services/PasswordResetService';

const PASSWORD_RESET_RESPONSE = 'Se houver uma conta com esse e-mail, enviaremos as instrucoes para redefinir a senha.';

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

    const token = jwt.sign({ id: usuario.id }, getJwtSecret(), { expiresIn: '1d' });
    setSessionCookies(res, token);

    return res.json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      }
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

    const senha_hash = await bcrypt.hash(senha, 12);

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha_hash
      }
    });

    return res.status(201).json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      }
    });
  };

  forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body;
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true, nome: true, email: true },
    });

    if (usuario) {
      const token = await createPasswordResetToken(usuario.id);
      try {
        await sendPasswordResetEmail({
          recipient: usuario.email,
          recipientName: usuario.nome,
          token,
        });
      } catch (error) {
        await discardPasswordResetToken(token);
        logger.error({ err: error, requestId: req.id, usuarioId: usuario.id }, 'password reset email failed');
      }
    }

    return res.json({ message: PASSWORD_RESET_RESPONSE });
  };

  resetPassword = async (req: Request, res: Response) => {
    const { token, senha } = req.body;
    const changed = await resetPasswordWithToken(token, senha);

    if (!changed) {
      return res.status(400).json({ message: 'Este link e invalido, expirou ou ja foi utilizado.' });
    }

    clearSessionCookies(res);
    return res.json({ message: 'Senha redefinida com sucesso. Entre novamente com a nova senha.' });
  };

  logout = async (_req: Request, res: Response) => {
    clearSessionCookies(res);
    return res.status(204).send();
  };
}
