import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { errorHandler } from './middlewares/errorHandler';
import { apiLimiter } from './middlewares/rateLimiter';
import { logger } from './utils/logger';
import routes from './routes';

const app = express();

// Necessário atrás de proxy (Netlify, Vercel, nginx) para rate-limit e IPs corretos
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : true,
    credentials: true,
  })
);
app.use(express.json());
app.use(pinoHttp({ logger }));

// General rate limiter for all routes
app.use(apiLimiter);

// Rota inicial / Health check
app.get('/', (req, res) => {
  res.json({ message: 'Bem-vindo à API do Kakebo! 🚀' });
});

app.use('/api', routes);

app.use(errorHandler);

export default app;
