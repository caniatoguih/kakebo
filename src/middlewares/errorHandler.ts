import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Erro de validação',
      errors: err.errors
    });
  }

  // Handle other types of custom errors (e.g., AppError) here if needed

  logger.error({ err, requestId: req.id, method: req.method, path: req.path, usuarioId: req.usuario_id }, 'request failed');

  // NODE_ENV isn't set inside a deployed Netlify Function at runtime, so relying on
  // it alone was always leaking full error messages/stack traces (including internal
  // file paths and the database host) to API responses in production.
  const isProduction =
    process.env.NODE_ENV === 'production' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  return res.status(500).json({
    message: 'Erro interno no servidor',
    error: isProduction ? undefined : err.message,
    stack: isProduction ? undefined : err.stack
  });
};
