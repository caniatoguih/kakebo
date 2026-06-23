import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contasService, type ContaData } from '@/services/contasService';
import { NovaContaModal } from '@/components/Contas/NovaContaModal';
import { PagarFaturaModal } from '@/components/Contas/PagarFaturaModal';
import { FaturasCardModal } from '@/components/Contas/FaturasCardModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, CreditCard, PiggyBank, Banknote, Trash2 } from 'lucide-react';

const tipoConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  Corrente: { icon: Wallet, label: 'Conta Corrente', color: 'text-pink-500' },
  Poupanca: { icon: PiggyBank, label: 'Poupança', color: 'text-green-500' },
  Dinheiro: { icon: Banknote, label: 'Dinheiro', color: 'text-yellow-500' },
  CartaoCredito: { icon: CreditCard, label: 'Cartão de Crédito', color: 'text-purple-500' },
};

function ContaCard({ conta, onDelete }: { conta: ContaData; onDelete: (id: string, nome: string) => void }): React.ReactElement {
  const config = tipoConfig[conta.tipo] || tipoConfig.Corrente;
  const Icon = config.icon;
  const isCartao = conta.tipo === 'CartaoCredito';
  const saldo = Number(conta.saldo_atual ?? 0);
  const limite = Number(conta.cartao_detalhe?.limite_total ?? 0);
  const disponivel = isCartao ? limite - Math.abs(saldo) : null;

  return (
    <Card className="hover:shadow-md transition-shadow duration-200 border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">{conta.nome}</CardTitle>
        <div className="flex items-center gap-1">
          <NovaContaModal contaParaEditar={conta} />
          {conta.id && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(conta.id!, conta.nome)}
              className="h-8 w-8 text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30 rounded-lg"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Icon className={`h-5 w-5 ${config.color}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-xs text-muted-foreground">{config.label}</p>
        {isCartao ? (
          <>
            <p className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(disponivel ?? 0)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">disponível</span>
            </p>
            
            {/* Barra de progresso do limite comprometido */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 my-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-purple-500 to-indigo-600 h-1.5 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${Math.min(limite > 0 ? (Math.abs(saldo) / limite) * 100 : 0, 100)}%` }}
              />
            </div>

            <p className="text-xs text-muted-foreground pb-2 flex justify-between">
              <span>Limite: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(limite)}</span>
              {conta.cartao_detalhe && (
                <span>Fecha dia {conta.cartao_detalhe.dia_fechamento} · Vence dia {conta.cartao_detalhe.dia_vencimento}</span>
              )}
            </p>
            
            <div className="pt-3 flex justify-between items-center border-t border-slate-100 dark:border-slate-800/40 mt-2">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fatura do Mês</span>
                <span className="text-base font-extrabold text-purple-600 dark:text-purple-400">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(conta.fatura_atual ?? 0))}
                </span>
              </div>
              
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Comprometido</span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(saldo))}
                </span>
              </div>
            </div>

            <div className="pt-3 flex gap-2 justify-end border-t border-slate-100 dark:border-slate-800/40 mt-2">
              <FaturasCardModal cartao={conta} />
              <PagarFaturaModal cartao={conta} />
            </div>
          </>
        ) : (
          <p className={`text-2xl font-bold ${saldo < 0 ? 'text-red-500 dark:text-red-400' : ''}`}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldo)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function Contas(): React.ReactElement {
  const queryClient = useQueryClient();

  const { data: contas = [], isLoading, isError } = useQuery<ContaData[]>({
    queryKey: ['contas'],
    queryFn: contasService.listar,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contasService.excluir(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['relatorio-reflexao'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Erro ao excluir conta.');
    }
  });

  const handleDelete = (id: string, nome: string) => {
    if (confirm(`Deseja realmente excluir a conta "${nome}"? Isso excluirá permanentemente todas as transações associadas a ela!`)) {
      deleteMutation.mutate(id);
    }
  };

  const contasComuns = contas.filter(c => c.tipo !== 'CartaoCredito');
  const cartoes = contas.filter(c => c.tipo === 'CartaoCredito');

  const saldoTotal = contasComuns.reduce((acc, c) => acc + Number(c.saldo_atual ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contas & Cartões</h1>
          <p className="text-muted-foreground">Gerencie suas contas bancárias e cartões de crédito.</p>
        </div>
        <NovaContaModal />
      </div>

      {/* Saldo Total */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="text-sm font-medium opacity-80">Saldo Total em Contas</p>
            <p className="text-4xl font-bold mt-1">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoTotal)}
            </p>
          </div>
          <Wallet className="h-12 w-12 opacity-40" />
        </CardContent>
      </Card>

      {isLoading && <p className="text-muted-foreground text-center py-8">Carregando contas...</p>}
      {isError && <p className="text-destructive text-center py-8">Erro ao carregar contas. Verifique a conexão.</p>}

      {/* Contas Bancárias */}
      {contasComuns.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground uppercase tracking-wider text-xs">Contas Bancárias</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contasComuns.map(conta => <ContaCard key={conta.id} conta={conta} onDelete={handleDelete} />)}
          </div>
        </section>
      )}

      {/* Cartões de Crédito */}
      {cartoes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground uppercase tracking-wider text-xs">Cartões de Crédito</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cartoes.map(conta => <ContaCard key={conta.id} conta={conta} onDelete={handleDelete} />)}
          </div>
        </section>
      )}

      {!isLoading && contas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Wallet className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Nenhuma conta cadastrada</p>
          <p className="text-sm text-muted-foreground mt-1">Clique em "Nova Conta" para começar.</p>
        </div>
      )}
    </div>
  );
}
