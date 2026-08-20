import rateLimit from 'express-rate-limit';

const defaultApiLimit = process.env.NODE_ENV === 'development' ? 1_000 : 300;
const apiLimit = Number(process.env.RATE_LIMIT_MAX ?? defaultApiLimit);

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // O limite é por IP e precisa acomodar aplicações com consultas frequentes,
  // especialmente quando mais de uma pessoa compartilha a mesma rede.
  limit: process.env.NODE_ENV === 'test' ? 1_000 : apiLimit,
  standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  skip: (req) => req.path.startsWith('/api/maps') || req.originalUrl.startsWith('/api/maps/'),
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

export const passwordResetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1_000 : 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    message: 'Muitas solicitacoes de recuperacao. Tente novamente apos 15 minutos.',
  },
});
