import { Request, Response } from 'express';
import crypto from 'crypto';

export const AUTH_COOKIE = 'kakebo_session';
export const CSRF_COOKIE = 'kakebo_csrf';

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(header.split(';').map((part) => {
    const [name, ...value] = part.trim().split('=');
    return [decodeURIComponent(name), decodeURIComponent(value.join('='))];
  }));
}

export function setSessionCookies(res: Response, token: string): void {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
  res.cookie(CSRF_COOKIE, crypto.randomBytes(32).toString('hex'), {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookies(res: Response): void {
  const options = { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
  res.clearCookie(AUTH_COOKIE, { ...options, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false });
}
