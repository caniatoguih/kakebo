import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { contasService, type ContaData } from '@/services/contasService';
import { transacoesService } from '@/services/transacoesService';
import { CheckCircle2, DollarSign } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';
import { notify } from '@/components/FeedbackHost';

interface PagarFaturaModalProps {
  cartao: ContaData;
}

export function PagarFaturaModal({ cartao }: PagarFaturaModalProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Buscar contas comuns para débito (tudo exceto outros cartões de crédito)
  const { data: contas = [] } = useQuery<ContaData[]>({
    queryKey: ['contas'],
    queryFn: contasService.listar,
  });

  const contasComuns = contas.filter(c => c.tipo !== 'CartaoCredito');

  // Estados locais do modal
  const [contaOrigemId, setContaOrigemId] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [valorPago, setValorPago] = useState<number>(() => Math.max(Number(cartao.fatura_fechada ?? 0), 0));
  const [dataPagamento, setDataPagamento] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const payMutation = useMutation({
    mutationFn: async (payload: { conta_origem_id: string; valor: number; data_pagamento: string }) => {
      return transacoesService.pagarFatura({
        cartao_id: cartao.id!,
        fatura_id: cartao.fatura_fechada_id,
        conta_origem_id: payload.conta_origem_id,
        valor: payload.valor,
        data_pagamento: payload.data_pagamento,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['relatorio-reflexao'] });
      queryClient.invalidateQueries({ queryKey: ['faturas-cartao', cartao.id] });
      setOpen(false);
      notify('Pagamento da fatura registrado com sucesso.', 'success');
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Erro ao registrar o pagamento da fatura.');
    },
  });

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Pré-preenche somente o saldo da última fatura já fechada.
      setValorPago(Math.max(Number(cartao.fatura_fechada ?? 0), 0));
      setFormError('');
      // Pré-seleciona a primeira conta comum disponível se existir
      if (contasComuns.length > 0) {
        setContaOrigemId(contasComuns[0].id!);
      }
    }
  };

  const handleConfirm = () => {
    if (payMutation.isPending) return;
    if (!contaOrigemId) {
      setFormError('Selecione a conta de origem para o pagamento.');
      return;
    }
    if (valorPago <= 0) {
      setFormError('O valor do pagamento deve ser maior que zero.');
      return;
    }
    if (valorPago > Number(cartao.fatura_fechada ?? 0)) {
      setFormError('O pagamento não pode superar o saldo restante da fatura.');
      return;
    }
    setFormError('');

    payMutation.mutate({
      conta_origem_id: contaOrigemId,
      valor: valorPago,
      data_pagamento: dataPagamento,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 rounded-lg border-purple-200/60 dark:border-purple-900/40 text-purple-600 dark:text-purple-400 bg-purple-50/40 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-950/40 font-semibold px-2.5 flex items-center gap-1 transition-all duration-300"
        >
          <DollarSign className="h-3.5 w-3.5" />
          Pagar Fatura
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-2xl border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Pagar Fatura — {cartao.nome}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
            Abata a dívida do seu cartão gerando uma transferência a partir de outra conta bancária.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Devedor Atual */}
          <div className="p-3.5 rounded-xl bg-purple-50/40 dark:bg-purple-950/10 border border-purple-100/50 dark:border-purple-900/20 flex justify-between items-center">
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
              Fatura Fechada:
            </span>
            <span className="text-lg font-extrabold text-purple-700 dark:text-purple-400">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(Number(cartao.fatura_fechada ?? 0), 0))}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <span className="block font-semibold uppercase tracking-wide">Competência</span>
              <span className="mt-1 block text-sm font-bold text-slate-700 dark:text-slate-200">
                {cartao.fatura_fechada_competencia ?? 'Não identificada'}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <span className="block font-semibold uppercase tracking-wide">Vencimento</span>
              <span className="mt-1 block text-sm font-bold text-slate-700 dark:text-slate-200">
                {cartao.fatura_fechada_vencimento
                  ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(cartao.fatura_fechada_vencimento))
                  : '—'}
              </span>
            </div>
          </div>

          {formError && (
            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:bg-rose-950/20 dark:text-rose-300">
              {formError}
            </p>
          )}

          {/* Conta de Origem */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500">Debitar da Conta</Label>
            <Select value={contaOrigemId} onValueChange={setContaOrigemId}>
              <SelectTrigger className="h-10 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 focus:ring-blue-600">
                <SelectValue placeholder="Selecione a conta de origem" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                {contasComuns.map((c) => (
                  <SelectItem key={c.id} value={c.id!} className="rounded-lg">
                    {c.nome} (Saldo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(c.saldo_atual ?? 0))})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor Pago */}
          <div className="space-y-1.5">
            <Label htmlFor="valorPago" className="text-xs font-bold text-slate-500">Valor do Pagamento</Label>
            <CurrencyInput
              id="valorPago"
              value={valorPago}
              onChange={(val) => setValorPago(val)}
              placeholder="R$ 0,00"
              className="h-10 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border-slate-200"
            />
            <p className="text-xs text-slate-400">Saldo restante máximo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cartao.fatura_fechada ?? 0))}</p>
          </div>

          {/* Data do Pagamento */}
          <div className="space-y-1.5">
            <Label htmlFor="dataPagamento" className="text-xs font-bold text-slate-500">Data do Pagamento</Label>
            <Input
              id="dataPagamento"
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              className="h-10 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border-slate-200"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="ghost" 
            onClick={() => setOpen(false)}
            className="rounded-xl h-10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={payMutation.isPending || Number(cartao.fatura_fechada ?? 0) <= 0}
            className="rounded-xl h-10 bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-1.5 px-4"
          >
            <CheckCircle2 className="h-4.5 w-4.5" />
            {payMutation.isPending ? 'Processando...' : 'Confirmar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
