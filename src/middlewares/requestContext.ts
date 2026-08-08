import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from '../observability/requestContext';

const VALID_REQUEST_ID = /^[a-zA-Z0-9._:-]{1,128}$/;

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const received = req.header('x-request-id');
  const requestId = received && VALID_REQUEST_ID.test(received) ? received : crypto.randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  runWithRequestContext({ requestId }, next);
}
