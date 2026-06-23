import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { contasService, type ContaData } from '@/services/contasService';
import { PlusCircle, Pencil } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';

const formSchema = z.object({
  nome: z.string().min(2, 'Nome muito curto'),
  tipo: z.enum(['Corrente', 'Poupanca', 'Dinheiro', 'CartaoCredito']),
  saldo_inicial: z.coerce.number().optional(),
  saldo_atual: z.coerce.number().optional(),
  limite_total: z.coerce.number().optional(),
  dia_fechamento: z.coerce.number().min(1).max(31).optional(),
  dia_vencimento: z.coerce.number().min(1).max(31).optional(),
  conta_pagamento_padrao_id: z.string().nullable().optional(),
});

type FormInput = z.input<typeof formSchema>;

interface NovaContaModalProps {
  contaParaEditar?: ContaData;
}

export function NovaContaModal({ contaParaEditar }: NovaContaModalProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const isEditing = !!contaParaEditar;

  const { register, handleSubmit, setValue, watch, reset, control, formState: { errors } } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { tipo: 'Corrente', saldo_inicial: 0 }
  });

  const tipo = watch('tipo');
  const isCartao = tipo === 'CartaoCredito';

  const { data: contas } = useQuery<ContaData[]>({
    queryKey: ['contas'],
    queryFn: () => contasService.listar()
  });

  const contasDisponiveis = contas?.filter(c => c.tipo !== 'CartaoCredito') || [];

  // Preenche o formulário quando estiver editando
  useEffect(() => {
    if (contaParaEditar && open) {
      reset({
        nome: contaParaEditar.nome,
        tipo: contaParaEditar.tipo,
        saldo_inicial: Number(contaParaEditar.saldo_inicial ?? 0),
        limite_total: Number(contaParaEditar.cartao_detalhe?.limite_total ?? 0),
        dia_fechamento: contaParaEditar.cartao_detalhe?.dia_fechamento,
        dia_vencimento: contaParaEditar.cartao_detalhe?.dia_vencimento,
        conta_pagamento_padrao_id: contaParaEditar.cartao_detalhe?.conta_pagamento_padrao_id,
      });
      setValue('tipo', contaParaEditar.tipo);
    } else if (!open) {
      reset({ tipo: 'Corrente', saldo_inicial: 0 });
    }
  }, [open, contaParaEditar]);

  const mutation = useMutation({
    mutationFn: (data: FormInput) => {
      if (isEditing && contaParaEditar?.id) {
        // Edição
        const payload: any = { nome: data.nome };
        if (isCartao) {
          payload.limite_total = data.limite_total;
          payload.dia_fechamento = data.dia_fechamento;
          payload.dia_vencimento = data.dia_vencimento;
          payload.conta_pagamento_padrao_id = data.conta_pagamento_padrao_id || null;
        } else {
          payload.saldo_inicial = data.saldo_inicial;
        }
        return contasService.atualizar(contaParaEditar.id!, payload);
      } else {
        // Criação
        const payload: any = { nome: data.nome, tipo: data.tipo };
        if (isCartao) {
          payload.limite_total = data.limite_total;
          payload.dia_fechamento = data.dia_fechamento;
          payload.dia_vencimento = data.dia_vencimento;
          payload.conta_pagamento_padrao_id = data.conta_pagamento_padrao_id || null;
        } else {
          payload.saldo_inicial = data.saldo_inicial;
        }
        return contasService.criar(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      setOpen(false);
      reset();
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Erro ao salvar conta.');
    }
  });

  const trigger = isEditing ? (
    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
      <Pencil className="h-4 w-4" />
    </Button>
  ) : (
    <Button className="gap-2"><PlusCircle className="h-4 w-4" /> Nova Conta</Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Editar: ${contaParaEditar?.nome}` : 'Adicionar Conta / Cartão'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d: FormInput) => mutation.mutate(d))} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input placeholder="Ex: Nubank, Carteira" {...register('nome')} />
            {errors.nome && <span className="text-xs text-destructive">{errors.nome.message}</span>}
          </div>

          {/* Tipo só pode mudar na criação */}
          {!isEditing && (
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select onValueChange={(v) => setValue('tipo', v as any)} defaultValue="Corrente">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Corrente">Conta Corrente</SelectItem>
                  <SelectItem value="Poupanca">Conta Poupança</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro (Carteira)</SelectItem>
                  <SelectItem value="CartaoCredito">Cartão de Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {!isCartao && (
            <div className="space-y-2">
              <Label>Saldo Inicial</Label>
              <Controller
                control={control}
                name="saldo_inicial"
                render={({ field: { onChange, onBlur, value, ref } }) => (
                  <CurrencyInput
                    placeholder="R$ 0,00"
                    value={value as number | undefined}
                    onChange={onChange}
                    onBlur={onBlur}
                    ref={ref}
                  />
                )}
              />
            </div>
          )}

          {isCartao && (
            <div className="space-y-4 rounded-lg border p-4 bg-muted/40">
              <p className="text-sm font-medium text-muted-foreground">Detalhes do Cartão</p>
              <div className="space-y-2">
                <Label>Limite Total</Label>
                <Controller
                  control={control}
                  name="limite_total"
                  render={({ field: { onChange, onBlur, value, ref } }) => (
                    <CurrencyInput
                      placeholder="R$ 5.000,00"
                      value={value as number | undefined}
                      onChange={onChange}
                      onBlur={onBlur}
                      ref={ref}
                    />
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dia de Fechamento</Label>
                  <Input type="number" min="1" max="31" placeholder="25" {...register('dia_fechamento')} />
                </div>
                <div className="space-y-2">
                  <Label>Dia de Vencimento</Label>
                  <Input type="number" min="1" max="31" placeholder="5" {...register('dia_vencimento')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Conta Padrão para Pagamento</Label>
                <Select
                  onValueChange={(v) => setValue('conta_pagamento_padrao_id', v === 'none' ? null : v)}
                  value={watch('conta_pagamento_padrao_id') || 'none'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma conta..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {contasDisponiveis.map(c => (
                      <SelectItem key={c.id} value={c.id!}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Conta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
