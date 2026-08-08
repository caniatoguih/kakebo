import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { AUTH_COOKIE, CSRF_COOKIE, parseCookies } from '../utils/cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method) || !parseCookies(req)[AUTH_COOKIE]) return next();
  const cookieToken = parseCookies(req)[CSRF_COOKIE];
  const headerToken = req.header('x-csrf-token');
  if (!cookieToken || !headerToken) return res.status(403).json({ message: 'Token CSRF ausente ou inválido.' });
  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  if (cookieBuffer.length !== headerBuffer.length || !crypto.timingSafeEqual(cookieBuffer, headerBuffer)) {
    return res.status(403).json({ message: 'Token CSRF ausente ou inválido.' });
  }
  next();
}
