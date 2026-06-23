import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { transacoesService, type TransacaoData } from '@/services/transacoesService';
import { contasService, type ContaData } from '@/services/contasService';
import { categoriasService } from '@/services/categoriasService';
import { PlusCircle, Pencil } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';

const formSchema = z.object({
  descricao: z.string().min(3, 'Descrição muito curta'),
  valor: z.coerce.number().min(0.01, 'O valor deve ser maior que zero'),
  tipo: z.enum(['Receita', 'Despesa', 'Transferencia']),
  data_transacao: z.string(),
  status: z.enum(['Pendente', 'Pago']),
  conta_id: z.string().min(1, 'Selecione uma conta'),
  subcategoria_id: z.string().optional().nullable(),
  total_parcelas: z.coerce.number().min(1).optional(),
});

type FormData = z.infer<typeof formSchema>;
type FormInput = z.input<typeof formSchema>;

interface Props {
  editItem?: TransacaoData;
  trigger?: React.ReactNode;
}

export function NovaTransacaoModal({ editItem, trigger }: Props = {}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [tipoRepeticao, setTipoRepeticao] = useState<'Unica' | 'Parcelada' | 'Recorrente'>('Unica');
  const queryClient = useQueryClient();

  // Busca contas reais da API
  const { data: contas = [] } = useQuery<ContaData[]>({
    queryKey: ['contas'],
    queryFn: contasService.listar,
    enabled: open,
  });

  // Busca categorias reais da API
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: categoriasService.listar,
    enabled: open,
  });

  const { register, handleSubmit, setValue, watch, reset, control, formState: { errors } } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo: 'Despesa',
      status: 'Pago',
      data_transacao: new Date().toLocaleDateString('sv-SE'),
      total_parcelas: 1
    }
  });

  const tipo = watch('tipo');
  const conta_id = watch('conta_id');
  const subcategoria_id = watch('subcategoria_id');
  const status = watch('status');
  
  // Filtra as categorias de acordo com o tipo selecionado (Receita ou Despesa)
  const categoriasFiltradas = categorias.filter((c: any) => c.tipo === tipo);

  // Efeito para reinicializar o formulário com os valores do item que está sendo editado ao abrir o modal
  React.useEffect(() => {
    if (open) {
      const formattedDate = editItem?.data_transacao
        ? editItem.data_transacao.substring(0, 10)
        : new Date().toLocaleDateString('sv-SE');

      reset({
        descricao: editItem?.descricao ?? '',
        valor: editItem?.valor ?? ('' as unknown as number),
        tipo: editItem?.tipo ?? 'Despesa',
        status: editItem?.status ?? 'Pago',
        data_transacao: formattedDate,
        conta_id: editItem?.conta_id ?? '',
        subcategoria_id: editItem?.subcategoria_id ?? '',
        total_parcelas: editItem?.total_parcelas ?? 1
      });

      if (editItem) {
        if (editItem.recorrente) {
          setTipoRepeticao('Recorrente');
        } else if (editItem.total_parcelas && editItem.total_parcelas > 1) {
          setTipoRepeticao('Parcelada');
        } else {
          setTipoRepeticao('Unica');
        }
      } else {
        setTipoRepeticao('Unica');
      }
    }
  }, [open, editItem, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      if (editItem && editItem.id) {
        return transacoesService.editar(editItem.id, data as TransacaoData);
      }
      return transacoesService.criar(data as TransacaoData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['relatorio-reflexao'] });
      setOpen(false);
      if (!editItem) {
        reset();
      }
    },
    onError: (error: any) => {
      console.error('Erro ao salvar:', error);
      alert(error.response?.data?.message || 'Erro ao salvar transação.');
    }
  });

  const onSubmit = (data: FormInput): void => {
    // A API backend espera um ISO 8601 com timezone (z.string().datetime())
    const isoDate = new Date(data.data_transacao + "T00:00:00").toISOString();
    
    let finalRecorrente = false;
    let finalTotalParcelas = 1;

    if (!editItem) {
      if (tipoRepeticao === 'Parcelada') {
        finalTotalParcelas = Number(data.total_parcelas) || 1;
      } else if (tipoRepeticao === 'Recorrente') {
        finalRecorrente = true;
        finalTotalParcelas = Number(data.total_parcelas) || 1;
      }
    } else {
      finalRecorrente = !!editItem.recorrente;
      finalTotalParcelas = editItem.total_parcelas ?? 1;
    }

    const payload = {
      ...data,
      data_transacao: isoDate,
      recorrente: finalRecorrente,
      total_parcelas: finalTotalParcelas
    } as unknown as FormData;

    mutation.mutate(payload);
  };

  const defaultTrigger = editItem ? (
    <Button variant="ghost" size="icon" className="h-8 w-8 text-pink-600 hover:text-pink-800 hover:bg-pink-50 dark:text-pink-400 dark:hover:bg-pink-900/30 rounded-lg">
      <Pencil className="h-4 w-4" />
    </Button>
  ) : (
    <Button className="gap-2">
      <PlusCircle className="h-4 w-4"/> Nova Transação
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Editar Transação' : 'Registrar Transação'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" {...register('descricao')} placeholder="Ex: Compra do mês" />
            {errors.descricao && <span className="text-xs text-destructive">{errors.descricao.message}</span>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor</Label>
              <Controller
                control={control}
                name="valor"
                render={({ field: { onChange, onBlur, value, ref } }) => (
                  <CurrencyInput
                    id="valor"
                    placeholder="R$ 0,00"
                    value={value as number | undefined}
                    onChange={onChange}
                    onBlur={onBlur}
                    ref={ref}
                  />
                )}
              />
              {errors.valor && <span className="text-xs text-destructive">{errors.valor.message}</span>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" type="date" {...register('data_transacao')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select onValueChange={(val) => {
                setValue('tipo', val as any);
                setValue('subcategoria_id', ''); // Resetar subcategoria ao mudar tipo
              }} value={tipo}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Despesa">Despesa</SelectItem>
                  <SelectItem value="Receita">Receita</SelectItem>
                  <SelectItem value="Transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select onValueChange={(val) => setValue('status', val as any)} value={status}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pago">Pago / Recebido</SelectItem>
                  <SelectItem value="Pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Conta Origem/Destino</Label>
            <Select onValueChange={(val) => setValue('conta_id', val)} value={conta_id || undefined}>
              <SelectTrigger>
                <SelectValue placeholder={contas.length === 0 ? 'Nenhuma conta cadastrada' : 'Selecione a conta'} />
              </SelectTrigger>
              <SelectContent>
                {contas.map((conta: ContaData) => (
                  <SelectItem key={conta.id} value={conta.id!}>
                    {conta.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.conta_id && <span className="text-xs text-destructive">{errors.conta_id.message}</span>}
          </div>

          <div className="space-y-2">
            <Label>Subcategoria (Opcional)</Label>
            <Select onValueChange={(val) => setValue('subcategoria_id', val)} value={subcategoria_id || undefined}>
              <SelectTrigger>
                <SelectValue placeholder={categoriasFiltradas.length === 0 ? 'Nenhuma categoria' : 'Selecione a categoria'} />
              </SelectTrigger>
              <SelectContent>
                {categoriasFiltradas.map((cat: any) => (
                  <SelectGroup key={cat.id}>
                    <SelectLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat.nome}</SelectLabel>
                    {cat.subcategorias.map((sub: any) => (
                      <SelectItem key={sub.id} value={sub.id}>{sub.nome}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipo === 'Despesa' && !editItem && (
            <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <div className="space-y-1.5">
                <Label>Repetição do Lançamento</Label>
                <Select
                  onValueChange={(val) => setTipoRepeticao(val as any)}
                  value={tipoRepeticao}
                >
                  <SelectTrigger className="bg-white dark:bg-slate-950">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unica">Lançamento Único</SelectItem>
                    <SelectItem value="Parcelada">Compra Parcelada (Dividir valor)</SelectItem>
                    <SelectItem value="Recorrente">Assinatura / Recorrência (Valor cheio mensal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipoRepeticao === 'Parcelada' && (
                <div className="space-y-1.5">
                  <Label htmlFor="parcelas">Número de Parcelas</Label>
                  <Input
                    id="parcelas"
                    type="number"
                    min="2"
                    placeholder="Ex: 12"
                    className="bg-white dark:bg-slate-950"
                    {...register('total_parcelas')}
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    O valor total inserido será dividido igualmente entre os meses.
                  </p>
                </div>
              )}

              {tipoRepeticao === 'Recorrente' && (
                <div className="space-y-1.5">
                  <Label htmlFor="meses_recorrencia">Duração da Recorrência (meses)</Label>
                  <Input
                    id="meses_recorrencia"
                    type="number"
                    min="2"
                    placeholder="Ex: 12"
                    className="bg-white dark:bg-slate-950"
                    {...register('total_parcelas')}
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    O valor cheio inserido será lançado mensalmente para cada mês.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Salvar Transação'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
