import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/FeedbackHost';
import { FormFieldError } from '@/components/FormFieldError';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { transacoesService, type TransacaoData } from '@/services/transacoesService';
import { contasService, type ContaData } from '@/services/contasService';
import { categoriasService } from '@/services/categoriasService';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, Pencil, PlusCircle, WalletCards } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  descricao: z.string().min(3, 'Descrição muito curta'),
  valor: z.coerce.number().min(0.01, 'O valor deve ser maior que zero'),
  tipo: z.enum(['Receita', 'Despesa', 'Transferencia']),
  data_transacao: z.string(),
  status: z.enum(['Pendente', 'Pago']),
  conta_id: z.string().min(1, 'Selecione uma conta'),
  conta_destino_id: z.string().optional(),
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

  const { register, handleSubmit, setValue, setError, watch, reset, control, formState: { errors } } = useForm<FormInput>({
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
  const conta_destino_id = watch('conta_destino_id');
  const valor = Number(watch('valor') ?? 0);
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

      const transferItems = editItem?.transferencia_grupo?.transacoes ?? [];
      const sourceTransfer = transferItems.find((item) => item.transferencia_direcao === 'Saida');
      const destinationTransfer = transferItems.find((item) => item.transferencia_direcao === 'Entrada');
      reset({
        descricao: editItem?.descricao.replace(/^\[(?:Saída|Entrada)\]\s*/, '') ?? '',
        valor: editItem?.valor ?? ('' as unknown as number),
        tipo: editItem?.tipo ?? 'Despesa',
        status: editItem?.status ?? 'Pago',
        data_transacao: formattedDate,
        conta_id: sourceTransfer?.conta_id ?? editItem?.conta_id ?? '',
        conta_destino_id: destinationTransfer?.conta_id ?? '',
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
      notify(editItem ? 'Lançamento atualizado com sucesso.' : 'Lançamento registrado com sucesso.', 'success');
    },
    onError: (error: any) => {
      console.error('Erro ao salvar:', error);
      notify(error.response?.data?.message || 'Erro ao salvar transação.');
    }
  });

  const onSubmit = (data: FormInput): void => {
    if (data.tipo === 'Transferencia') {
      if (!data.conta_destino_id) {
        setError('conta_destino_id', { message: 'Selecione a conta de destino.' });
        return;
      }
      if (data.conta_destino_id === data.conta_id) {
        setError('conta_destino_id', { message: 'A conta de destino deve ser diferente da origem.' });
        return;
      }
    }
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
    <Button aria-label={`Editar ${editItem.descricao}`} variant="ghost" size="icon" className="h-9 w-9 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30 rounded-lg">
      <Pencil className="h-4 w-4" />
    </Button>
  ) : (
    <Button className="gap-2">
      <PlusCircle className="h-4 w-4"/> Nova Transação
    </Button>
  );

  const selectedSource = contas.find((conta) => conta.id === conta_id);
  const selectedDestination = contas.find((conta) => conta.id === conta_destino_id);
  const sourceBalance = Number(selectedSource?.saldo_atual ?? 0);
  const hasInsufficientBalance = tipo === 'Transferencia' && status === 'Pago' && valor > sourceBalance;
  const brl = (amount: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  const typeOptions = [
    { value: 'Despesa' as const, label: 'Despesa', description: 'Dinheiro que saiu', icon: ArrowUpRight, color: 'rose' },
    { value: 'Receita' as const, label: 'Receita', description: 'Dinheiro que entrou', icon: ArrowDownLeft, color: 'emerald' },
    { value: 'Transferencia' as const, label: 'Transferência', description: 'Entre suas contas', icon: ArrowRight, color: 'blue' },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-[560px]">
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Editar Transação' : 'Registrar Transação'}</DialogTitle>
          <DialogDescription>
            {editItem ? 'Atualize os dados deste lançamento financeiro.' : 'Preencha os dados do novo lançamento financeiro.'}
          </DialogDescription>
        </DialogHeader>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-5 pb-24 sm:px-6 sm:pb-6">
          {!editItem && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">O que você quer registrar?</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {typeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = tipo === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setValue('tipo', option.value, { shouldValidate: true });
                        setValue('subcategoria_id', '');
                        if (option.value !== 'Transferencia') setValue('conta_destino_id', '');
                      }}
                      className={cn(
                        'relative flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition-colors sm:flex-col sm:items-start',
                        active ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 dark:bg-emerald-950/20' : 'border-border hover:bg-muted/50',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>
                        <span className="block text-sm font-semibold">{option.label}</span>
                        <span className="block text-xs text-muted-foreground">{option.description}</span>
                      </span>
                      {active && <Check className="absolute right-2 top-2 h-4 w-4 text-emerald-600" />}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {editItem && (
            <div className="rounded-xl border bg-muted/40 px-3 py-2 text-sm">
              Tipo: <strong>{tipo === 'Transferencia' ? 'Transferência entre contas' : tipo}</strong>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" aria-invalid={!!errors.descricao} aria-describedby={errors.descricao ? 'transaction-description-error' : undefined} {...register('descricao')} placeholder="Ex: Compra do mês" />
            <FormFieldError id="transaction-description-error" message={errors.descricao?.message} />
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
                    aria-invalid={!!errors.valor}
                    aria-describedby={errors.valor ? 'transaction-value-error' : undefined}
                    placeholder="R$ 0,00"
                    value={value as number | undefined}
                    onChange={onChange}
                    onBlur={onBlur}
                    ref={ref}
                  />
                )}
              />
              <FormFieldError id="transaction-value-error" message={errors.valor?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" type="date" {...register('data_transacao')} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status do lançamento</Label>
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
            <Label>{tipo === 'Transferencia' ? 'Conta de Origem' : 'Conta Origem/Destino'}</Label>
            <Select onValueChange={(val) => {
              setValue('conta_id', val);
              if (val === conta_destino_id) setValue('conta_destino_id', '');
            }} value={conta_id || undefined}>
              <SelectTrigger aria-invalid={!!errors.conta_id} aria-describedby={errors.conta_id ? 'transaction-account-error' : undefined}>
                <SelectValue placeholder={contas.length === 0 ? 'Nenhuma conta cadastrada' : 'Selecione a conta'} />
              </SelectTrigger>
              <SelectContent>
                {contas.map((conta: ContaData) => (
                  <SelectItem key={conta.id} value={conta.id!}>
                    {conta.nome} · {brl(Number(conta.saldo_atual ?? 0))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormFieldError id="transaction-account-error" message={errors.conta_id?.message} />
          </div>

          {tipo === 'Transferencia' && (
            <div className="space-y-2">
              <Label>Conta de Destino</Label>
              <Select onValueChange={(val) => setValue('conta_destino_id', val)} value={conta_destino_id || undefined}>
                <SelectTrigger aria-invalid={!!errors.conta_destino_id} aria-describedby={errors.conta_destino_id ? 'transaction-destination-error' : undefined}>
                  <SelectValue placeholder="Selecione a conta que receberá o valor" />
                </SelectTrigger>
                <SelectContent>
                  {contas.filter((conta) => conta.id !== conta_id).map((conta) => (
                    <SelectItem key={conta.id} value={conta.id!}>{conta.nome} · {brl(Number(conta.saldo_atual ?? 0))}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormFieldError id="transaction-destination-error" message={errors.conta_destino_id?.message} />
            </div>
          )}

          {tipo === 'Transferencia' && selectedSource && selectedDestination && valor > 0 && (
            <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
                <WalletCards className="h-4 w-4" /> Resumo da transferência
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{selectedSource.nome}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-blue-600" />
                <span className="text-right font-medium">{selectedDestination.nome}</span>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>{brl(valor)}</strong> sairão de {selectedSource.nome} e entrarão em {selectedDestination.nome}.
              </p>
              {status === 'Pago' && (
                <div className="grid grid-cols-2 gap-3 border-t border-blue-200 pt-3 text-xs dark:border-blue-900/50">
                  <span>Saldo após envio<br /><strong>{brl(sourceBalance - valor)}</strong></span>
                  <span className="text-right">Saldo após receber<br /><strong>{brl(Number(selectedDestination.saldo_atual ?? 0) + valor)}</strong></span>
                </div>
              )}
              {hasInsufficientBalance && (
                <p role="alert" className="rounded-lg bg-amber-100 p-2 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                  Atenção: o valor supera o saldo atual da conta de origem e deixará o saldo negativo.
                </p>
              )}
            </div>
          )}

          {tipo !== 'Transferencia' && selectedSource && valor > 0 && (
            <div className={cn(
              'space-y-3 rounded-xl border p-4',
              tipo === 'Despesa'
                ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/20'
                : 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20',
            )}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <WalletCards className="h-4 w-4" /> Resumo do lançamento
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>{selectedSource.nome}</span>
                <strong className={tipo === 'Despesa' ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}>
                  {tipo === 'Despesa' ? '-' : '+'}{brl(valor)}
                </strong>
              </div>
              {status === 'Pago' ? (
                <p className="border-t pt-3 text-xs">
                  Saldo após o lançamento: <strong>{brl(sourceBalance + (tipo === 'Despesa' ? -valor : valor))}</strong>
                </p>
              ) : (
                <p className="border-t pt-3 text-xs text-muted-foreground">
                  Como o lançamento está pendente, o saldo atual não será alterado agora.
                </p>
              )}
              {tipo === 'Despesa' && status === 'Pago' && valor > sourceBalance && (
                <p role="alert" className="rounded-lg bg-amber-100 p-2 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                  Atenção: esta despesa deixará o saldo da conta negativo.
                </p>
              )}
            </div>
          )}

          {tipo !== 'Transferencia' && <div className="space-y-2">
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
          </div>}

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
                  <p className="text-xs text-muted-foreground italic">
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
                  <p className="text-xs text-muted-foreground italic">
                    O valor cheio inserido será lançado mensalmente para cada mês.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 p-4 backdrop-blur sm:static sm:-mx-6 sm:-mb-6 sm:mt-6 sm:px-6 sm:py-4">
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
