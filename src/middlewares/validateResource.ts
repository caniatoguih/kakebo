import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';

export const validateResource = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (e) {
      next(e);
    }
  };
};
