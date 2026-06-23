import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';

export class OrcamentoRepository {
  async findByMesAno(usuario_id: string, mes: number, ano: number) {
    return prisma.orcamento.findMany({
      where: {
        usuario_id,
        mes,
        ano
      },
      include: {
        subcategoria: {
          include: {
            categoria: true
          }
        }
      }
    });
  }
}
