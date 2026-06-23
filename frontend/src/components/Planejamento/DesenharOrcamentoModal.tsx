import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { transacoesService, type TransacaoData } from '@/services/transacoesService';
import { orcamentosService, type OrcamentoPayload } from '@/services/orcamentosService';
import { categoriasService } from '@/services/categoriasService';
import { Sparkles, TrendingUp, TrendingDown, Wallet, Check, AlertCircle, Calendar } from 'lucide-react';

interface Props {
  mes: number;
  ano: number;
}

interface SugestaoOrcamento {
  subcategoria_id: string;
  subcategoria_nome: string;
  categoria_nome: string;
  pilar: string;
  valor_previsto: number;
  valor_sugerido: number; // Editável localmente
  selecionado: boolean;
}

export function DesenharOrcamentoModal({ mes, ano }: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Estado local para controle das sugestões que o usuário pode editar ou desselecionar
  const [sugestoes, setSugestoes] = useState<SugestaoOrcamento[]>([]);

  // Busca todas as categorias para mapear as subcategorias às categorias pais
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: categoriasService.listar,
    enabled: open,
  });

  // Busca as transações previstas/realizadas do mês selecionado
  const { data: transacoesResponse, isLoading, isError } = useQuery({
    queryKey: ['transacoes-planejamento-forecast', mes, ano],
    queryFn: () => transacoesService.listar({ mes, ano, limit: 1000 }),
    enabled: open,
  });

  const transacoes: TransacaoData[] = transacoesResponse?.transacoes || [];

  // Mapeamento plano de subcategorias
  const subcategoriasMap = useMemo(() => {
    const map = new Map<string, { nome: string; categoriaNome: string; pilar: string }>();
    categorias.forEach((cat: any) => {
      cat.subcategorias?.forEach((sub: any) => {
        map.set(sub.id, {
          nome: sub.nome,
          categoriaNome: cat.nome,
          pilar: cat.pilar,
        });
      });
    });
    return map;
  }, [categorias]);

  // Cálculos do fluxo de caixa e preparação das sugestões
  const { previsaoReceita, previsaoDespesa, receitaItens } = useMemo(() => {
    let receitaSum = 0;
    let despesaSum = 0;
    const rItens: Array<{ descricao: string; valor: number; data: string }> = [];

    transacoes.forEach((t) => {
      const valor = Number(t.valor);
      if (t.tipo === 'Receita') {
        receitaSum += valor;
        rItens.push({
          descricao: t.descricao,
          valor,
          data: t.data_transacao,
        });
      } else if (t.tipo === 'Despesa') {
        despesaSum += valor;
      }
    });

    return { previsaoReceita: receitaSum, previsaoDespesa: despesaSum, receitaItens: rItens };
  }, [transacoes]);

  // Efeito para sincronizar os dados das transações com o estado local editável das sugestões
  React.useEffect(() => {
    if (transacoes.length === 0 || subcategoriasMap.size === 0) return;

    // Agrupa as despesas por subcategoria
    const agrupado = new Map<string, number>();
    transacoes.forEach((t) => {
      if (t.tipo === 'Despesa' && t.subcategoria_id) {
        agrupado.set(t.subcategoria_id, (agrupado.get(t.subcategoria_id) || 0) + Number(t.valor));
      }
    });

    const novasSugestoes: SugestaoOrcamento[] = [];
    agrupado.forEach((valor_previsto, subId) => {
      const info = subcategoriasMap.get(subId);
      if (info) {
        novasSugestoes.push({
          subcategoria_id: subId,
          subcategoria_nome: info.nome,
          categoria_nome: info.categoriaNome,
          pilar: info.pilar,
          valor_previsto,
          valor_sugerido: valor_previsto,
          selecionado: true,
        });
      }
    });

    // Ordena por pilar para ficar consistente com a interface principal
    const pilarOrder = ['Sobrevivencia', 'Lazer', 'Cultura', 'Extras'];
    novasSugestoes.sort((a, b) => pilarOrder.indexOf(a.pilar) - pilarOrder.indexOf(b.pilar));

    setSugestoes(novasSugestoes);
  }, [transacoes, subcategoriasMap]);

  // Mutação em lote para salvar os orçamentos propostos
  const batchMutation = useMutation({
    mutationFn: (items: OrcamentoPayload[]) => orcamentosService.salvarBatch(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos', mes, ano] });
      setOpen(false);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Erro ao gerar o orçamento em lote.');
    },
  });

  const handleToggleSelect = (index: number) => {
    setSugestoes((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, selecionado: !item.selecionado } : item))
    );
  };

  const handleValueChange = (index: number, val: number) => {
    setSugestoes((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, valor_sugerido: val } : item))
    );
  };

  const handleConfirmar = () => {
    const itemsParaSalvar = sugestoes
      .filter((s) => s.selecionado && s.valor_sugerido > 0)
      .map((s) => ({
        subcategoria_id: s.subcategoria_id,
        mes,
        ano,
        valor_orcado: s.valor_sugerido,
      }));

    if (itemsParaSalvar.length === 0) {
      alert('Nenhum item com valor válido selecionado.');
      return;
    }

    batchMutation.mutate(itemsParaSalvar);
  };

  const brl = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-emerald-500/30 hover:border-emerald-500/60 dark:hover:bg-emerald-500/10 font-semibold shadow-sm transition-all duration-300">
          <Sparkles className="h-4 w-4 text-emerald-500 animate-pulse" />
          Desenhar do Fluxo
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            Desenhar Orçamento do Fluxo de Caixa
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Compare suas previsões de receitas e gastos para o período selecionado e desenhe seu orçamento automaticamente.
          </p>
        </DialogHeader>

        {/* Corpo com Scroll */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 min-h-0 pr-1">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-slate-400 gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              Verificando previsões no fluxo de caixa...
            </div>
          )}

          {isError && (
            <div className="flex items-center justify-center py-12 text-sm text-red-500 gap-2">
              <AlertCircle className="h-5 w-5" />
              Erro ao carregar dados do fluxo de caixa.
            </div>
          )}

          {!isLoading && !isError && transacoes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-slate-400 gap-3 border border-dashed rounded-2xl bg-muted/20">
              <Calendar className="h-10 w-10 text-slate-300 dark:text-slate-700" />
              <div className="space-y-1">
                <p className="font-bold">Nenhum lançamento no fluxo de caixa</p>
                <p className="text-xs text-muted-foreground px-8">
                  Para gerar sugestões automáticas, cadastre transações previstas ou realizadas com datas neste mês.
                </p>
              </div>
            </div>
          )}

          {!isLoading && !isError && transacoes.length > 0 && (
            <>
              {/* Dashboard de Previsão do Mês */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
                <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/15 rounded-xl p-3.5 flex flex-col justify-center gap-0.5">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" /> Previsão de Receita
                  </span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {brl(previsaoReceita)}
                  </span>
                  <span className="text-[9px] text-muted-foreground truncate">Esperado de entradas</span>
                </div>

                <div className="bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/15 rounded-xl p-3.5 flex flex-col justify-center gap-0.5">
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
                    <TrendingDown className="h-3.5 w-3.5" /> Previsão de Gasto
                  </span>
                  <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                    {brl(previsaoDespesa)}
                  </span>
                  <span className="text-[9px] text-muted-foreground truncate">Esperado de saídas</span>
                </div>

                <div className={`border rounded-xl p-3.5 flex flex-col justify-center gap-0.5 ${
                  previsaoReceita >= previsaoDespesa 
                    ? 'bg-pink-500/5 dark:bg-pink-500/10 border-pink-500/15 text-pink-600 dark:text-pink-400'
                    : 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5" /> Saldo Previsto
                  </span>
                  <span className="text-xl font-black">
                    {brl(previsaoReceita - previsaoDespesa)}
                  </span>
                  <span className="text-[9px] text-muted-foreground truncate">
                    {previsaoReceita >= previsaoDespesa ? 'Superávit estimado' : 'Déficit estimado'}
                  </span>
                </div>
              </div>

              {/* Lista de Gastos Sugeridos por Subcategoria */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Sugestões de Orçamento de Despesas ({sugestoes.length})
                  </Label>
                  <span className="text-[11px] font-medium text-slate-400">
                    {sugestoes.filter(s => s.selecionado).length} selecionadas
                  </span>
                </div>

                <div className="border border-slate-200/60 dark:border-slate-800/80 rounded-xl overflow-hidden divide-y bg-background/50">
                  {sugestoes.map((item, idx) => (
                    <div
                      key={item.subcategoria_id}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-3 hover:bg-muted/30 transition-colors ${
                        !item.selecionado ? 'opacity-60 bg-muted/10' : ''
                      }`}
                    >
                      {/* Checkbox e Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          id={`chk-${item.subcategoria_id}`}
                          checked={item.selecionado}
                          onChange={() => handleToggleSelect(idx)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">
                            {item.subcategoria_nome}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5 truncate">
                            {item.categoria_nome} • <span className="italic">{item.pilar}</span>
                          </p>
                        </div>
                      </div>

                      {/* Valores e Input */}
                      <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Previsto no Fluxo</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{brl(item.valor_previsto)}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Label htmlFor={`val-${item.subcategoria_id}`} className="text-[10px] font-bold text-muted-foreground sm:hidden">Orçar:</Label>
                          <Input
                            id={`val-${item.subcategoria_id}`}
                            type="number"
                            step="0.01"
                            value={item.valor_sugerido}
                            onChange={(e) => handleValueChange(idx, Math.max(0, parseFloat(e.target.value) || 0))}
                            disabled={!item.selecionado}
                            className="w-[100px] h-8 text-xs font-bold text-right pr-2 rounded-lg bg-background"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Informações Auxiliares de Receitas */}
              {receitaItens.length > 0 && (
                <div className="p-3 bg-muted/40 border border-slate-200/30 dark:border-slate-800/40 rounded-xl space-y-2">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    🔍 Detalhamento das Receitas Previstas ({receitaItens.length})
                  </h4>
                  <div className="max-h-[100px] overflow-y-auto space-y-1.5 pr-1">
                    {receitaItens.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[11px] font-medium">
                        <span className="text-slate-500 truncate">{item.descricao}</span>
                        <span className="text-emerald-500 font-bold">{brl(item.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 pt-4 border-t flex justify-end gap-2 bg-background">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={
              batchMutation.isPending ||
              isLoading ||
              isError ||
              transacoes.length === 0 ||
              sugestoes.filter((s) => s.selecionado).length === 0
            }
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
          >
            {batchMutation.isPending && (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
            )}
            {!batchMutation.isPending && <Check className="h-4 w-4" />}
            Confirmar e Desenhar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
