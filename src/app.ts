import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { errorHandler } from './middlewares/errorHandler';
import { apiLimiter } from './middlewares/rateLimiter';
import { logger } from './utils/logger';
import routes from './routes';
import { getJwtSecret } from './config/security';
import { requireCsrf } from './middlewares/requireCsrf';
import { requestContext } from './middlewares/requestContext';
import { metricsMiddleware } from './observability/metrics';

// Falha imediatamente em caso de implantação sem uma chave de autenticação segura.
getJwtSecret();

const app = express();

// Necessário atrás de proxy (Netlify, Vercel, nginx) para rate-limit e IPs corretos
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : ['http://localhost:5173'],
    credentials: true,
  })
);
app.use(express.json());
app.use(requestContext);
app.use(metricsMiddleware);
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.id,
  customProps: (req) => ({ requestId: req.id }),
}));
app.use(requireCsrf);

// General rate limiter for all routes
app.use(apiLimiter);

// Rota inicial / Health check
app.get('/', (req, res) => {
  res.json({ message: 'Bem-vindo à API do Kakebo! 🚀' });
});

app.use('/api', routes);

app.use(errorHandler);

export default app;
