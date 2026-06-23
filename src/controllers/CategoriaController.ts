import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// Seed padrão dos 4 pilares Kakebo com subcategorias
const KAKEBO_SEED = [
  {
    nome: 'Sobrevivência',
    pilar: 'Sobrevivencia',
    tipo: 'Despesa',
    subcategorias: ['Aluguel / Moradia', 'Mercado / Alimentação', 'Transporte', 'Saúde', 'Internet / Telefone', 'Energia / Água'],
  },
  {
    nome: 'Lazer',
    pilar: 'Lazer',
    tipo: 'Despesa',
    subcategorias: ['Restaurantes', 'Streaming / Entretenimento', 'Viagens', 'Hobbies'],
  },
  {
    nome: 'Cultura',
    pilar: 'Cultura',
    tipo: 'Despesa',
    subcategorias: ['Livros / Cursos', 'Cinema / Teatro', 'Eventos Culturais'],
  },
  {
    nome: 'Extras / Imprevistos',
    pilar: 'Extras',
    tipo: 'Despesa',
    subcategorias: ['Presente / Doação', 'Emergências', 'Outros'],
  },
  {
    nome: 'Receitas',
    pilar: 'Sobrevivencia',
    tipo: 'Receita',
    subcategorias: ['Salário', 'Freelance', 'Investimentos', 'Outros'],
  },
];

export class CategoriaController {
  list = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;

    try {
      let categorias = await prisma.categoria.findMany({
        where: { usuario_id },
        include: { subcategorias: true },
        orderBy: { nome: 'asc' },
      });

      // Seed automático: se o usuário ainda não tem categorias, cria os padrões Kakebo
      if (categorias.length === 0) {
        await Promise.all(
          KAKEBO_SEED.map((cat) =>
            prisma.categoria.create({
              data: {
                usuario_id,
                nome: cat.nome,
                pilar: cat.pilar,
                tipo: cat.tipo,
                subcategorias: {
                  create: cat.subcategorias.map((nome) => ({ nome })),
                },
              },
            })
          )
        );

        categorias = await prisma.categoria.findMany({
          where: { usuario_id },
          include: { subcategorias: true },
          orderBy: { nome: 'asc' },
        });
      }

      return res.json(categorias);
    } catch (error: any) {
      return res.status(500).json({ message: 'Erro ao listar categorias', error: error.message });
    }
  };

  create = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { nome, pilar, tipo, subcategorias } = req.body;

    try {
      const categoria = await prisma.categoria.create({
        data: {
          usuario_id,
          nome,
          pilar,
          tipo,
          subcategorias: {
            create: (subcategorias ?? []).map((nome: string) => ({ nome })),
          },
        },
        include: { subcategorias: true },
      });
      return res.status(201).json(categoria);
    } catch (error: any) {
      return res.status(400).json({ message: 'Erro ao criar categoria', error: error.message });
    }
  };

  createSubcategoria = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { id } = req.params; // ID da Categoria Pai
    const { nome } = req.body;

    try {
      // Valida se a categoria existe e pertence ao usuário
      const categoria = await prisma.categoria.findFirst({
        where: { id, usuario_id }
      });

      if (!categoria) {
        return res.status(404).json({ message: 'Categoria não encontrada.' });
      }

      const subcategoria = await prisma.subcategoria.create({
        data: {
          nome,
          categoria_id: id
        }
      });
      
      return res.status(201).json(subcategoria);
    } catch (error: any) {
      return res.status(400).json({ message: 'Erro ao criar subcategoria', error: error.message });
    }
  };

  deleteSubcategoria = async (req: Request, res: Response) => {
    const usuario_id = req.usuario_id!;
    const { subId } = req.params;

    try {
      // Valida se a subcategoria existe e pertence ao usuário
      const subcategoria = await prisma.subcategoria.findFirst({
        where: { 
          id: subId,
          categoria: { usuario_id }
        }
      });

      if (!subcategoria) {
        return res.status(404).json({ message: 'Subcategoria não encontrada.' });
      }

      // Verifica se está em uso (tem transações ou orçamentos atrelados)
      const countTransacoes = await prisma.transacao.count({ where: { subcategoria_id: subId } });
      const countOrcamentos = await prisma.orcamento.count({ where: { subcategoria_id: subId } });

      if (countTransacoes > 0 || countOrcamentos > 0) {
        return res.status(400).json({ 
          message: 'Não é possível excluir esta subcategoria pois ela já possui transações ou orçamentos vinculados.' 
        });
      }

      await prisma.subcategoria.delete({
        where: { id: subId }
      });

      return res.status(204).send();
    } catch (error: any) {
      return res.status(400).json({ message: 'Erro ao deletar subcategoria', error: error.message });
    }
  };
}
