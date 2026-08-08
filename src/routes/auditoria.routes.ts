import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middlewares/requireAuth';

const routes = Router();
routes.use(requireAuth);

routes.get('/', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const events = await prisma.auditoriaFinanceira.findMany({
    where: { usuario_id: req.usuario_id },
    orderBy: [{ data_criacao: 'desc' }, { id: 'desc' }],
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, request_id: true, acao: true, entidade: true,
      entidade_id: true, dados: true, data_criacao: true,
    },
  });
  res.json({ eventos: events, proximo_cursor: events.length === limit ? events.at(-1)?.id : null });
});

export default routes;
