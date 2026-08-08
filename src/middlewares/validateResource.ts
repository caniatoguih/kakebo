import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';

export const validateResource = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.body = parsed.body ?? req.body;
      Object.assign(req.params, parsed.params ?? {});
      Object.assign(req.query, parsed.query ?? {});
      next();
    } catch (e) {
      next(e);
    }
  };
};
