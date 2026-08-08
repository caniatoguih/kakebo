import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/security';
import { AUTH_COOKIE, parseCookies } from '../utils/cookies';
import { setContextUser } from '../observability/requestContext';

interface JwtPayload {
  id: string;
}

declare global {
  namespace Express {
    interface Request {
      usuario_id?: string;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = parseCookies(req)[AUTH_COOKIE]
    ?? (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);

  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido ou inválido' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    
    req.usuario_id = decoded.id;
    setContextUser(decoded.id);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token expirado ou inválido' });
  }
};
