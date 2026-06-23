import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { categoriasService } from '@/services/categoriasService';
import { orcamentosService, type OrcamentoPayload } from '@/services/orcamentosService';
import { PlusCircle } from 'lucide-react';

const formSchema = z.object({
  subcategoria_id: z.string().min(1, 'Selecione uma subcategoria'),
  valor_orcado: z.coerce.number().min(0.01, 'O valor deve ser maior que zero'),
});

type FormInput = z.input<typeof formSchema>;
// z.infer used only through FormInput; output type inferred by zodResolver

interface Props {
  mes: number;
  ano: number;
  /** Se fornecido, abre em modo edição */
  editItem?: { id: string; subcategoria_id: string; subcategoria_nome: string; valor_orcado: number };
  trigger?: React.ReactNode;
}

export function NovoOrcamentoModal({ mes, ano, editItem, trigger }: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: categoriasService.listar,
    enabled: open,
  });

  // Apenas categorias de Despesa para orçar
  const categoriasDespesa = categorias.filter((c) => c.tipo === 'Despesa');

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subcategoria_id: editItem?.subcategoria_id ?? '',
      valor_orcado: editItem?.valor_orcado ?? ('' as unknown as number),
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormInput) => {
      const payload: OrcamentoPayload = {
        subcategoria_id: data.subcategoria_id,
        mes,
        ano,
        valor_orcado: data.valor_orcado as unknown as number,
      };
      return orcamentosService.salvar(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos', mes, ano] });
      setOpen(false);
      reset();
    },
    onError: (err) => {
      console.error('Erro ao salvar orçamento:', err);
      alert('Erro ao salvar. Verifique se está autenticado.');
    },
  });

  const onSubmit = (data: FormInput) => {
    mutation.mutate(data);
  };

  const defaultTrigger = editItem ? (
    <Button variant={'ghost' as any} size={'sm' as any} className="h-7 px-2 text-xs">
      Editar
    </Button>
  ) : (
    <Button className="gap-2">
      <PlusCircle className="h-4 w-4" />
      Novo Orçamento
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {editItem ? `Editar: ${editItem.subcategoria_nome}` : 'Novo Orçamento'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          {!editItem && (
            <div className="space-y-2">
              <Label>Subcategoria</Label>
              <Select
                onValueChange={(val) => setValue('subcategoria_id', val)}
                defaultValue=""
              >
                <SelectTrigger id="subcategoria_id">
                  <SelectValue placeholder="Selecione a subcategoria..." />
                </SelectTrigger>
                <SelectContent>
                  {categoriasDespesa.map((cat) => (
                    <SelectGroup key={cat.id}>
                      <SelectLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {cat.nome}
                      </SelectLabel>
                      {cat.subcategorias.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {sub.nome}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {errors.subcategoria_id && (
                <span className="text-xs text-destructive">{errors.subcategoria_id.message}</span>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="valor_orcado">Valor Orçado (R$)</Label>
            <Input
              id="valor_orcado"
              type="number"
              step="0.01"
              placeholder="0,00"
              {...register('valor_orcado')}
            />
            {errors.valor_orcado && (
              <span className="text-xs text-destructive">{errors.valor_orcado.message}</span>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant={'outline' as any} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
