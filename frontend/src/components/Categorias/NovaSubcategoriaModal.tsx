import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { categoriasService, type CategoriaData } from '@/services/categoriasService';
import { Plus } from 'lucide-react';

const formSchema = z.object({
  nome: z.string().min(2, 'O nome da subcategoria deve ter pelo menos 2 caracteres'),
});

type FormInput = z.input<typeof formSchema>;

interface NovaSubcategoriaModalProps {
  categoria: CategoriaData;
}

export function NovaSubcategoriaModal({ categoria }: NovaSubcategoriaModalProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormInput) => categoriasService.criarSubcategoria(categoria.id, data.nome),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      setOpen(false);
      reset();
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Erro ao criar subcategoria.');
    }
  });

  const onSubmit = (data: FormInput) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 border-dashed text-xs">
          <Plus className="h-3 w-3" /> Adicionar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Nova subcategoria em {categoria.nome}</DialogTitle>
          <DialogDescription className="sr-only">
            Formulário para adicionar uma nova subcategoria dentro de {categoria.nome}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome da Subcategoria</Label>
            <Input placeholder="Ex: Ração do cachorro, Freelance" {...register('nome')} />
            {errors.nome && <span className="text-xs text-destructive">{errors.nome.message}</span>}
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
