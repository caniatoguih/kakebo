import prisma from '../lib/prisma';

export async function assertAccountOwnership(contaId: string, usuarioId: string) {
  const conta = await prisma.contaBancaria.findFirst({ where: { id: contaId, usuario_id: usuarioId } });
  if (!conta) throw new Error('Conta bancária não encontrada.');
  return conta;
}

export async function assertSubcategoryOwnership(subcategoriaId: string | null | undefined, usuarioId: string) {
  if (!subcategoriaId) return null;
  const subcategoria = await prisma.subcategoria.findFirst({
    where: { id: subcategoriaId, categoria: { usuario_id: usuarioId } },
  });
  if (!subcategoria) throw new Error('Subcategoria não encontrada.');
  return subcategoria;
}
