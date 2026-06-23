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

  logger.error(err);
  
  const isProduction = process.env.NODE_ENV === 'production';
  return res.status(500).json({
    message: 'Erro interno no servidor',
    error: isProduction ? undefined : err.message,
    stack: isProduction ? undefined : err.stack
  });
};
