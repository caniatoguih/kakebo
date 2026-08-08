import pino from 'pino';

// `NETLIFY`/`NETLIFY_DEV` are build-time-only vars and aren't set inside a deployed
// Netlify Function at runtime, so they can't be used to detect production there.
// AWS_LAMBDA_FUNCTION_NAME is always present in that runtime (Netlify Functions run
// on Lambda) and is a reliable signal.
const isServerlessRuntime = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
const isProduction = process.env.NODE_ENV === 'production' || isServerlessRuntime;

function createPrettyStream() {
  if (isProduction) return undefined;
  try {
    // Built as a plain synchronous stream instead of pino's `transport` option:
    // `transport` spawns a worker thread that requires the target module by name,
    // which the bundled serverless function can't resolve, crashing every request.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('pino-pretty')({
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard',
    });
  } catch {
    return undefined;
  }
}

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie', 'req.headers.x-csrf-token',
      'req.headers.x-metrics-token', 'res.headers.set-cookie',
      'password', 'senha', 'senha_hash', 'token', 'authorization', 'cookie',
    ],
    censor: '[REDACTED]',
  },
}, createPrettyStream());
