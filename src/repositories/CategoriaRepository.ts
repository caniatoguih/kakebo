import prisma from '../lib/prisma';

export class CategoriaRepository {
  async findCategoriasComSubcategorias(usuario_id: string) {
    return prisma.categoria.findMany({
      where: { usuario_id },
      include: {
        subcategorias: true
      }
    });
  }
}
