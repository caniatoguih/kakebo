import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // As jornadas E2E percorrem todas as telas em sequência e compartilham o mesmo
  // IP no runner. Ambientes normais preservam a barreira mais restritiva.
  limit: process.env.NODE_ENV === 'test' ? 300 : 100,
  standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  message: {
    message: 'Muitas requisições feitas a partir deste IP, por favor tente novamente após 15 minutos.',
  },
});

// Stricter rate limiter for sensitive routes (e.g., login, register)
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10, // Limit each IP to 10 requests per `window`
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Muitas tentativas de autenticação, por favor tente novamente após uma hora.',
  },
});
