import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { contasService, type ContaData } from '@/services/contasService';
import { transacoesService } from '@/services/transacoesService';
import { Calendar, ChevronDown, ChevronUp, ShoppingBag, ArrowDownLeft, CalendarPlus, Ban } from 'lucide-react';

interface FaturasCardModalProps {
  cartao: ContaData;
}

interface TransacaoFatura {
  id: string;
  descricao: string;
  valor: string;
  tipo: 'Despesa' | 'Receita' | 'Transferencia';
  data_transacao: string;
  parcela_atual: number;
  total_parcelas: number;
  recorrente?: boolean;
  transacao_pai_id?: string;
  impacto_fatura: number;
}

interface FaturaMes {
  mes: string; // YYYY-MM
  total: number;
  total_pago: number;
  transacoes: TransacaoFatura[];
}

interface FaturasResponse {
  conta: {
    id: string;
    nome: string;
    limite_total: number;
    dia_fechamento: number;
    dia_vencimento: number;
  };
  faturas: FaturaMes[];
}

export function FaturasCardModal({ cartao }: FaturasCardModalProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError, refetch } = useQuery<FaturasResponse>({
    queryKey: ['faturas-cartao', cartao.id],
    queryFn: () => contasService.obterFaturas(cartao.id!),
    enabled: open && !!cartao.id,
  });

  const toggleMonth = (mes: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [mes]: !prev[mes]
    }));
  };

  const handleProrrogar = async (transacao_pai_id: string) => {
    if (!transacao_pai_id) return;
    const input = prompt("Quantos meses deseja prorrogar esta assinatura/recorrência?", "12");
    if (input === null) return; // Cancelado
    const meses = parseInt(input, 10);
    if (isNaN(meses) || meses < 1) {
      alert("Por favor, insira um número válido de meses (mínimo 1).");
      return;
    }
    
    try {
      const response = await transacoesService.prorrogar(transacao_pai_id, meses);
      alert(response.message);
      refetch();
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.message || "Erro ao prorrogar recorrência.");
    }
  };

  const handleCancelarRecorrencia = async (transacao_pai_id: string, parcela_limite: number) => {
    if (!transacao_pai_id) return;
    const confirmacao = window.confirm(
      `Deseja realmente encerrar esta recorrência/assinatura antecipadamente a partir da parcela ${parcela_limite}? \nTodas as cobranças e projeções futuras serão excluídas permanentemente do sistema.`
    );
    if (!confirmacao) return;

    try {
      const response = await transacoesService.cancelarRecorrencia(transacao_pai_id, parcela_limite);
      alert(response.message);
      refetch();
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.message || "Erro ao encerrar recorrência.");
    }
  };

  const formatMonthName = (mesStr: string) => {
    const [year, month] = mesStr.split('-');
    // 0-indexed month
    const date = new Date(Number(year), Number(month) - 1, 1);
    const formatted = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 rounded-lg border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-slate-50/40 dark:bg-slate-950/20 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold px-2.5 flex items-center gap-1 transition-all duration-300"
        >
          <Calendar className="h-3.5 w-3.5 text-slate-500" />
          Ver Faturas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto rounded-2xl border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Visão Mensal de Faturas — {cartao.nome}
          </DialogTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Acompanhe o detalhamento de compras e parcelamentos mês a mês.
          </p>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <p className="text-sm text-slate-400">Carregando projeções...</p>
            </div>
          )}

          {isError && (
            <p className="text-sm text-red-500 text-center py-6">
              Erro ao carregar as faturas do cartão. Verifique o servidor.
            </p>
          )}

          {!isLoading && !isError && data?.faturas.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              Nenhuma transação lançada neste cartão de crédito.
            </div>
          )}
          {!isLoading && !isError && data && (
            <div className="space-y-3">
              {data.faturas.map((fatura) => {
                const isExpanded = !!expandedMonths[fatura.mes];
                const totalInvoice = fatura.total;
                const totalPago = fatura.total_pago || 0;

                let badge = null;
                if (totalInvoice > 0) {
                  if (totalPago >= totalInvoice - 0.05) {
                    badge = (
                      <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 font-bold px-2 py-0.5 rounded-full text-[9px]">
                        Paga
                      </span>
                    );
                  } else if (totalPago > 0) {
                    badge = (
                      <span className="bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 font-bold px-2 py-0.5 rounded-full text-[9px]">
                        Parcial
                      </span>
                    );
                  } else {
                    badge = (
                      <span className="bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50 font-bold px-2 py-0.5 rounded-full text-[9px]">
                        Aberta
                      </span>
                    );
                  }
                }

                return (
                  <div 
                    key={fatura.mes} 
                    className="border border-slate-100 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    {/* Header do Mês */}
                    <button
                      onClick={() => toggleMonth(fatura.mes)}
                      className="w-full flex items-center justify-between p-4 bg-slate-50/40 dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors"
                    >
                      <div className="flex flex-col items-start">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {formatMonthName(fatura.mes)}
                          </span>
                          {badge}
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                          {fatura.transacoes.length} {fatura.transacoes.length === 1 ? 'lançamento' : 'lançamentos'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-base font-extrabold ${totalInvoice > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-green-600'}`}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalInvoice)}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4.5 w-4.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4.5 w-4.5 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* Transações Expandidas */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-950/40 divide-y divide-slate-100/50 dark:divide-slate-900/40">
                        {fatura.transacoes.map((t) => {
                          const isExpense = t.tipo === 'Despesa';
                          const isOutboundTransfer = t.tipo === 'Transferencia' && t.descricao.includes('[Saída]');
                          const isRefundOrPayment = !isExpense && !isOutboundTransfer;

                          return (
                            <div key={t.id} className="p-3.5 flex items-center justify-between text-sm hover:bg-slate-50/20">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`p-2 rounded-lg ${isRefundOrPayment ? 'bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400' : 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400'}`}>
                                  {isRefundOrPayment ? (
                                    <ArrowDownLeft className="h-4 w-4" />
                                  ) : (
                                    <ShoppingBag className="h-4 w-4" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                                    {t.descricao}
                                  </p>
                                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    <span>{formatDate(t.data_transacao)}</span>
                                    {t.total_parcelas > 1 && (
                                      <>
                                        <span>·</span>
                                        {t.recorrente ? (
                                          <div className="flex items-center gap-1.5">
                                            <span className="bg-pink-100/60 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 font-bold px-1.5 py-0.5 rounded text-[9px]">
                                              Recorrência {t.parcela_atual}/{t.total_parcelas}
                                            </span>
                                            {t.transacao_pai_id && (
                                              <>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleProrrogar(t.transacao_pai_id!);
                                                  }}
                                                  title="Prorrogar esta recorrência"
                                                  className="text-pink-600 dark:text-pink-400 hover:text-pink-800 dark:hover:text-pink-300 transition-colors duration-150 flex items-center gap-0.5 text-[9px] font-semibold border border-pink-200 dark:border-pink-800 bg-pink-50 dark:bg-pink-950/30 px-1 py-0.5 rounded-sm active:scale-95 cursor-pointer"
                                                >
                                                  <CalendarPlus className="h-2.5 w-2.5" />
                                                  <span>Prorrogar</span>
                                                </button>

                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCancelarRecorrencia(t.transacao_pai_id!, t.parcela_atual);
                                                  }}
                                                  title="Encerrar recorrência antecipadamente"
                                                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors duration-150 flex items-center gap-0.5 text-[9px] font-semibold border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 px-1 py-0.5 rounded-sm active:scale-95 cursor-pointer"
                                                >
                                                  <Ban className="h-2.5 w-2.5" />
                                                  <span>Encerrar</span>
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="bg-purple-100/60 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold px-1 rounded-sm text-[9px]">
                                            Parcela {t.parcela_atual}/{t.total_parcelas}
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-col items-end pl-3">
                                <span className={`font-bold ${isRefundOrPayment ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                  {isRefundOrPayment ? '-' : ''}
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(t.valor))}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
