import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';
import serverless from 'serverless-http';
import app from '../../src/app';

/**
 * Express app mounted at /api/*
 * Netlify rewrite: /api/* -> /.netlify/functions/api/:splat (status 200)
 * With rewrites, event.path usually keeps the original /api/... path.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const serverlessHandler = serverless(app) as (event: any, context: any) => Promise<HandlerResponse>;

function normalizePath(event: HandlerEvent): HandlerEvent {
  let path = event.path || '/';

  // Function URL direta: /.netlify/functions/api[/...]
  if (path.startsWith('/.netlify/functions/api')) {
    const rest = path.slice('/.netlify/functions/api'.length) || '';
    path = `/api${rest}`;
  }

  // Rewrite com splat sem prefixo /api (ex.: /health)
  if (!path.startsWith('/api')) {
    path = path === '/' ? '/api' : `/api${path.startsWith('/') ? path : `/${path}`}`;
  }

  return { ...event, path };
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Evita espera de conexão Prisma/DB além do timeout da function
  context.callbackWaitsForEmptyEventLoop = false;

  const normalized = normalizePath(event);
  return serverlessHandler(normalized, context);
};
