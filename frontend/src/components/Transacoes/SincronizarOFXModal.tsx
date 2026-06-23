import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { transacoesService } from '@/services/transacoesService';
import { contasService, type ContaData } from '@/services/contasService';
import { categoriasService } from '@/services/categoriasService';
import { Upload, Check, RefreshCw, CheckCircle2, HelpCircle, Plus, Trash2, ArrowLeftRight, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

interface ReconcileResult {
  message: string;
  conciliadasCount: number;
  naoEncontradasCount: number;
  suggestedTransfersCount: number;
  conciliadas: Array<{
    ofx: {
      tipo: 'Receita' | 'Despesa';
      valor: number;
      data: string;
      descricao: string;
    };
    transacao: {
      descricao: string;
      valor: number;
      data_transacao: string;
    };
    alreadyPaid?: boolean;
  }>;
  naoEncontradas: Array<{
    conta_id: string;
    conta_nome: string;
    tipo: 'Receita' | 'Despesa';
    valor: number;
    data: string;
    descricao: string;
    fitid: string;
  }>;
  suggestedTransfers: Array<{
    id: string;
    origem: {
      conta_id: string;
      conta_nome: string;
      tipo: 'Receita' | 'Despesa';
      valor: number;
      data: string;
      descricao: string;
      fitid: string;
    };
    destino: {
      conta_id: string;
      conta_nome: string;
      tipo: 'Receita' | 'Despesa';
      valor: number;
      data: string;
      descricao: string;
      fitid: string;
    };
    valor: number;
    data: string;
    descricao: string;
  }>;
}

interface QueuedFile {
  id: string;
  file: File;
  contaId: string;
  ofxText: string;
}

export function SincronizarOFXModal(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1); // 1: Upload Queue, 2: Resultado
  const [filesQueue, setFilesQueue] = useState<QueuedFile[]>([]);
  const [result, setResult] = useState<ReconcileResult | null>(null);

  // Estados locais mutáveis para permitir lançamentos sob demanda
  const [localNaoEncontradas, setLocalNaoEncontradas] = useState<ReconcileResult['naoEncontradas']>([]);
  const [localSuggestedTransfers, setLocalSuggestedTransfers] = useState<ReconcileResult['suggestedTransfers']>([]);
  const [localConciliadas, setLocalConciliadas] = useState<ReconcileResult['conciliadas']>([]);
  const [isBulkLaunching, setIsBulkLaunching] = useState(false);
  
  // Customização de campos por transação
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({});
  const [transactionTypes, setTransactionTypes] = useState<Record<string, 'Despesa' | 'Receita' | 'Transferencia'>>({});
  const [selectedSubcategories, setSelectedSubcategories] = useState<Record<string, string>>({});
  const [selectedDestinationAccounts, setSelectedDestinationAccounts] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();

  // Busca contas bancárias e categorias do Kakebo
  const { data: contas = [] } = useQuery<ContaData[]>({
    queryKey: ['contas'],
    queryFn: contasService.listar,
    enabled: open,
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: categoriasService.listar,
    enabled: open,
  });

  // Busca todas as transações do banco para lookup de recategorização de transferência
  const { data: transacoesResponse } = useQuery<any>({
    queryKey: ['transacoes-reconciliation-lookup'],
    queryFn: () => transacoesService.listar({ limit: 1000 }),
    enabled: open && step === 2,
  });

  const todasTransacoes = transacoesResponse?.transacoes || [];

  // Lista plana de subcategorias com o tipo da categoria pai
  const subcategoriasList = useMemo(() => {
    const list: Array<{ id: string; nome: string; categoriaNome: string; categoriaTipo: string }> = [];
    categorias.forEach((cat: any) => {
      cat.subcategorias?.forEach((sub: any) => {
        list.push({
          id: sub.id,
          nome: sub.nome,
          categoriaNome: cat.nome,
          categoriaTipo: cat.tipo // Receita ou Despesa
        });
      });
    });
    return list;
  }, [categorias]);

  // Função auxiliar para identificar se uma descrição é de transferência
  const isTransferDescription = (desc: string): boolean => {
    const lower = desc.toLowerCase();
    return (
      lower.includes('pix transf') ||
      lower.includes('ted') ||
      lower.includes('doc') ||
      lower.includes('transferencia') ||
      lower.includes('transferência') ||
      lower.includes('transf')
    );
  };

  // Efeito reativo para autodetecção inteligente de tipos, subcategorias e contas para os órfãos
  useEffect(() => {
    if (step !== 2 || localNaoEncontradas.length === 0) return;

    const newTypes = { ...transactionTypes };
    const newSubs = { ...selectedSubcategories };
    const newDests = { ...selectedDestinationAccounts };
    let changed = false;

    localNaoEncontradas.forEach(item => {
      const itemKey = `${item.descricao}-${item.data}-${item.valor}-${item.conta_id}`;
      
      if (newTypes[itemKey]) return;

      changed = true;

      // A. Detecção Inteligente de Pagamento de Fatura de Cartão de Crédito
      const lowerDesc = item.descricao.toLowerCase();
      const cardTerms = [
        'fatura', 'cartao', 'cartão', 'visa', 'mastercard', 'master', 
        'amex', 'nubank', 'itaucard', 'bradescard', 'pagto fatura', 
        'pagamento cart', 'pag. cart', 'liquidacao fatura', 'liquidacao cart', 
        'liq. cart'
      ];
      const hasCardTerm = cardTerms.some(term => lowerDesc.includes(term));
      const matchingCard = contas.find(c => 
        c.tipo === 'CartaoCredito' && 
        (Math.abs(Number(c.saldo_atual ?? 0)) === item.valor || hasCardTerm)
      );

      if (item.tipo === 'Despesa' && matchingCard) {
        newTypes[itemKey] = 'Transferencia';
        newDests[itemKey] = matchingCard.id!;
      }
      // B. Se a descrição for de transferência comum
      else if (isTransferDescription(item.descricao)) {
        if (item.tipo === 'Despesa') {
          newTypes[itemKey] = 'Transferencia';
          const otherConta = contas.find(c => c.id !== item.conta_id && c.tipo !== 'CartaoCredito');
          const fallbackConta = otherConta || contas.find(c => c.id !== item.conta_id);
          if (fallbackConta) {
            newDests[itemKey] = fallbackConta.id!;
          }
        } else {
          // Crédito no extrato (Recebimento): Busca se há uma saída correspondente em outra conta no banco
          const matchingOutflow = todasTransacoes.find((t: any) => {
            if (t.conta_id === item.conta_id) return false;
            if (t.tipo !== 'Transferencia' && t.tipo !== 'Despesa') return false;
            if (Number(t.valor) !== item.valor) return false;
            const d1 = new Date(t.data_transacao);
            const d2 = new Date(item.data);
            return d1.getFullYear() === d2.getFullYear() &&
                   d1.getMonth() === d2.getMonth() &&
                   d1.getDate() === d2.getDate();
          });

          if (matchingOutflow) {
            newTypes[itemKey] = 'Transferencia';
            newDests[itemKey] = matchingOutflow.conta_id;
          } else {
            newTypes[itemKey] = 'Receita';
            const matchedSub = subcategoriasList.find(sub => 
              sub.categoriaTipo === 'Receita' &&
              (item.descricao.toLowerCase().includes(sub.nome.toLowerCase()) || sub.nome.toLowerCase().includes(item.descricao.toLowerCase()))
            ) || subcategoriasList.find(sub => sub.categoriaTipo === 'Receita');
            
            if (matchedSub) {
              newSubs[itemKey] = matchedSub.id;
            }
          }
        }
      } else {
        newTypes[itemKey] = item.tipo;
        
        const matchedSub = subcategoriasList.find(sub => 
          sub.categoriaTipo === item.tipo &&
          (lowerDesc.includes(sub.nome.toLowerCase()) || sub.nome.toLowerCase().includes(lowerDesc))
        ) || subcategoriasList.find(sub => sub.categoriaTipo === item.tipo);
        
        if (matchedSub) {
          newSubs[itemKey] = matchedSub.id;
        }
      }
    });

    if (changed) {
      setTransactionTypes(newTypes);
      setSelectedSubcategories(newSubs);
      setSelectedDestinationAccounts(newDests);
    }
  }, [step, localNaoEncontradas, todasTransacoes, contas, subcategoriasList]);

  // Mutação em lote do Docker/Backend
  const reconcileBatchMutation = useMutation({
    mutationFn: (statements: Array<{ conta_id: string; ofxText: string }>) =>
      transacoesService.reconciliarOFXBatch(statements),
    onSuccess: (data: ReconcileResult) => {
      setResult(data);
      setLocalNaoEncontradas(data.naoEncontradas || []);
      setLocalSuggestedTransfers(data.suggestedTransfers || []);
      setLocalConciliadas(data.conciliadas || []);
      setStep(2);
      
      queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['relatorio-reflexao'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Erro ao sincronizar extratos OFX.');
    }
  });

  const lancarMutation = useMutation({
    mutationFn: (args: { isTransfer: boolean; data: any }) => {
      if (args.isTransfer) {
        return transacoesService.importar(args.data.conta_id, args.data.transacoes);
      } else {
        return transacoesService.criar(args.data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['relatorio-reflexao'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Erro ao lançar transação.');
    }
  });

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    Array.from(selectedFiles).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const target = event.target;
        if (target?.result) {
          setFilesQueue(prev => [
            ...prev,
            {
              id: `${file.name}-${file.size}-${Date.now()}`,
              file,
              contaId: '',
              ofxText: target.result as string
            }
          ]);
        }
      };
      reader.readAsText(file);
    });

    e.target.value = ''; // Limpa input
  };

  const handleMapAccount = (id: string, contaId: string) => {
    setFilesQueue(prev =>
      prev.map(item => (item.id === id ? { ...item, contaId } : item))
    );
  };

  const handleRemoveFile = (id: string) => {
    setFilesQueue(prev => prev.filter(item => item.id !== id));
  };

  const handleSyncSubmit = () => {
    if (filesQueue.length === 0) {
      alert('Adicione pelo menos um arquivo OFX.');
      return;
    }

    const hasUnmapped = filesQueue.some(item => !item.contaId);
    if (hasUnmapped) {
      alert('Associe todos os arquivos a uma conta bancária antes de prosseguir.');
      return;
    }

    const statements = filesQueue.map(item => ({
      conta_id: item.contaId,
      ofxText: item.ofxText
    }));

    reconcileBatchMutation.mutate(statements);
  };

  const handleLancarAvulso = (item: any) => {
    const itemKey = `${item.descricao}-${item.data}-${item.valor}-${item.conta_id}`;
    const desc = customDescriptions[itemKey] !== undefined ? customDescriptions[itemKey] : item.descricao;
    const currentType = transactionTypes[itemKey] || item.tipo;

    if (!desc.trim()) {
      alert('A descrição não pode ficar vazia.');
      return;
    }

    if (currentType === 'Transferencia') {
      const isCredit = item.tipo === 'Receita';
      const destAccountId = selectedDestinationAccounts[itemKey];
      
      if (!destAccountId) {
        alert(isCredit ? 'Selecione a conta de origem para a transferência.' : 'Selecione a conta de destino para a transferência.');
        return;
      }
      if (destAccountId === item.conta_id) {
        alert(isCredit ? 'A conta de origem não pode ser igual à conta de destino.' : 'A conta de destino não pode ser igual à conta de origem.');
        return;
      }

      const actualContaOrigemId = isCredit ? destAccountId : item.conta_id;
      const actualContaDestinoId = isCredit ? item.conta_id : destAccountId;

      lancarMutation.mutate({
        isTransfer: true,
        data: {
          conta_id: actualContaOrigemId,
          transacoes: [
            {
              valor: item.valor,
              tipo: 'Transferencia',
              conta_destino_id: actualContaDestinoId,
              descricao: desc,
              data_transacao: new Date(item.data).toISOString(),
              status: 'Pago'
            }
          ]
        }
      }, {
        onSuccess: () => {
          setLocalNaoEncontradas(prev => prev.filter(p => `${p.descricao}-${p.data}-${p.valor}-${p.conta_id}` !== itemKey));
          setLocalConciliadas(prev => [
            ...prev,
            {
              ofx: item,
              transacao: {
                descricao: isCredit ? `[Entrada] ${desc}` : `[Saída] ${desc}`,
                valor: item.valor,
                data_transacao: item.data
              }
            }
          ]);
          cleanupStates(itemKey);
        }
      });
    } else {
      const subId = selectedSubcategories[itemKey] || subcategoriasList.find(sub => sub.categoriaTipo === currentType)?.id;

      if (!subId) {
        alert('Selecione uma subcategoria compatível antes de lançar.');
        return;
      }

      lancarMutation.mutate({
        isTransfer: false,
        data: {
          conta_id: item.conta_id,
          descricao: desc,
          valor: item.valor,
          tipo: currentType,
          data_transacao: new Date(item.data).toISOString(),
          subcategoria_id: subId,
          status: 'Pago'
        }
      }, {
        onSuccess: () => {
          setLocalNaoEncontradas(prev => prev.filter(p => `${p.descricao}-${p.data}-${p.valor}-${p.conta_id}` !== itemKey));
          setLocalConciliadas(prev => [
            ...prev,
            {
              ofx: item,
              transacao: {
                descricao: desc,
                valor: item.valor,
                data_transacao: item.data
              }
            }
          ]);
          cleanupStates(itemKey);
        }
      });
    }
  };

  const handleLancarTransferenciaSugerida = (item: any) => {
    const desc = customDescriptions[item.id] || item.descricao || `Transferência entre ${item.origem.conta_nome} e ${item.destino.conta_nome}`;
    
    lancarMutation.mutate({
      isTransfer: true,
      data: {
        conta_id: item.origem.conta_id,
        transacoes: [
          {
            valor: item.valor,
            tipo: 'Transferencia',
            conta_destino_id: item.destino.conta_id,
            descricao: desc,
            data_transacao: new Date(item.data).toISOString(),
            status: 'Pago'
          }
        ]
      }
    }, {
      onSuccess: () => {
        setLocalSuggestedTransfers(prev => prev.filter(t => t.id !== item.id));
        setLocalConciliadas(prev => [
          ...prev,
          {
            ofx: item.origem,
            transacao: {
              descricao: `[Saída] ${desc}`,
              valor: item.valor,
              data_transacao: item.data
            }
          }
        ]);
        cleanupStates(item.id);
      }
    });
  };

  const handleIgnorarTransferenciaSugerida = (item: any) => {
    // Transforma a transferência sugerida de volta em 2 transações não encontradas separadas
    const t1 = item.origem;
    const t2 = item.destino;

    setLocalSuggestedTransfers(prev => prev.filter(t => t.id !== item.id));
    setLocalNaoEncontradas(prev => [...prev, t1, t2]);
  };

  const handleLancarTodasTransferencias = async () => {
    if (localSuggestedTransfers.length === 0) return;
    setIsBulkLaunching(true);

    try {
      const promises = localSuggestedTransfers.map(async (item) => {
        const desc = customDescriptions[item.id] || item.descricao || `Transferência entre ${item.origem.conta_nome} e ${item.destino.conta_nome}`;
        await transacoesService.importar(item.origem.conta_id, [
          {
            valor: item.valor,
            tipo: 'Transferencia',
            conta_destino_id: item.destino.conta_id,
            descricao: desc,
            data_transacao: new Date(item.data).toISOString(),
            status: 'Pago'
          }
        ]);
      });

      await Promise.all(promises);

      const newConciliadas = localSuggestedTransfers.map(item => {
        const desc = customDescriptions[item.id] || item.descricao || `Transferência entre ${item.origem.conta_nome} e ${item.destino.conta_nome}`;
        return {
          ofx: item.origem,
          transacao: {
            descricao: `[Saída] ${desc}`,
            valor: item.valor,
            data_transacao: item.data
          }
        };
      });

      setLocalConciliadas(prev => [...prev, ...newConciliadas]);
      setLocalSuggestedTransfers([]);
      
      queryClient.invalidateQueries({ queryKey: ['transacoes'] });
      queryClient.invalidateQueries({ queryKey: ['contas'] });
      queryClient.invalidateQueries({ queryKey: ['relatorio-reflexao'] });
    } catch (err) {
      alert("Erro ao lançar todas as transferências.");
    } finally {
      setIsBulkLaunching(false);
    }
  };

  const handleTypeChange = (itemKey: string, newType: 'Despesa' | 'Receita' | 'Transferencia') => {
    setTransactionTypes(prev => ({ ...prev, [itemKey]: newType }));
    setSelectedSubcategories(prev => {
      const updated = { ...prev };
      delete updated[itemKey];
      return updated;
    });
    setSelectedDestinationAccounts(prev => {
      const updated = { ...prev };
      delete updated[itemKey];
      return updated;
    });
  };

  const cleanupStates = (itemKey: string) => {
    setSelectedSubcategories(prev => {
      const updated = { ...prev };
      delete updated[itemKey];
      return updated;
    });
    setCustomDescriptions(prev => {
      const updated = { ...prev };
      delete updated[itemKey];
      return updated;
    });
    setTransactionTypes(prev => {
      const updated = { ...prev };
      delete updated[itemKey];
      return updated;
    });
    setSelectedDestinationAccounts(prev => {
      const updated = { ...prev };
      delete updated[itemKey];
      return updated;
    });
  };

  const resetModal = () => {
    setStep(1);
    setFilesQueue([]);
    setResult(null);
    setLocalNaoEncontradas([]);
    setLocalSuggestedTransfers([]);
    setLocalConciliadas([]);
    setSelectedSubcategories({});
    setCustomDescriptions({});
    setTransactionTypes({});
    setSelectedDestinationAccounts({});
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetModal();
  };

  const allMapped = filesQueue.length > 0 && filesQueue.every(item => item.contaId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-emerald-500/30 hover:border-emerald-500/60 dark:hover:bg-emerald-500/10 font-medium">
          <RefreshCw className="h-4 w-4 text-emerald-500" />
          Sincronizar OFX
        </Button>
      </DialogTrigger>

      <DialogContent className={`border-border flex flex-col transition-all duration-300 ${step === 2 ? 'sm:max-w-[1000px] h-[85vh]' : 'sm:max-w-[550px]'}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            Sincronizar Extratos OFX
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Importe múltiplos arquivos de extrato (.ofx) simultaneamente e associe-os às suas contas para conciliação inteligente."}
            {step === 2 && "Dashboard de Reconciliação Inteligente Kakebo. Revise as transações conciliadas e lance transferências detectadas com 1 clique."}
          </DialogDescription>
        </DialogHeader>

        {/* PASSO 1: Fila de Upload e Seleção */}
        {step === 1 && (
          <div className="space-y-4 py-2 flex flex-col min-h-0">
            {/* Box Principal de Arrastar/Selecionar */}
            <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center gap-2 hover:bg-accent/30 transition-colors cursor-pointer relative shrink-0">
              <input
                type="file"
                accept=".ofx"
                multiple
                onChange={handleFilesSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="h-8 w-8 text-emerald-500" />
              <p className="text-sm font-medium">Arraste ou clique para carregar extratos (.ofx)</p>
              <p className="text-xs text-muted-foreground text-center">Você pode carregar múltiplos extratos de bancos diferentes ao mesmo tempo.</p>
            </div>

            {/* Lista da Fila de Arquivos */}
            {filesQueue.length > 0 && (
              <div className="flex-1 overflow-y-auto max-h-[220px] pr-1 space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mapeamento de Contas ({filesQueue.length})</p>
                {filesQueue.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/40 border rounded-lg hover:bg-muted/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{item.file.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(item.file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="w-[180px] shrink-0">
                      <Select value={item.contaId} onValueChange={(val) => handleMapAccount(item.id, val)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Escolha a conta..." />
                        </SelectTrigger>
                        <SelectContent>
                          {contas.map((c) => (
                            <SelectItem key={c.id} value={c.id!} className="text-xs">{c.nome} ({c.tipo})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFile(item.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-red-500 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Como funciona */}
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 space-y-1.5 text-[11px] leading-relaxed shrink-0">
              <h3 className="font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="h-3.5 w-3.5" />
                Dica de Ouro das Transferências
              </h3>
              <p className="text-muted-foreground">
                Se você subir os extratos de **origem** e **destino** juntos (ex: Conta Corrente e Fatura de Cartão), o sistema irá detectar as saídas e entradas idênticas e criará a **Transferência completa entre contas** com um único clique, atualizando os dois saldos automaticamente!
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t mt-auto">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                onClick={handleSyncSubmit}
                disabled={!allMapped || reconcileBatchMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2 text-xs h-9 px-4"
              >
                {reconcileBatchMutation.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
                Sincronizar Extratos
              </Button>
            </div>
          </div>
        )}

        {/* PASSO 2: Resultado e Dashboard da Conciliação */}
        {step === 2 && result && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4 py-1">
            {/* Metas/Estatísticas */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3 flex flex-col justify-center gap-0.5">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Conciliações Automáticas</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{localConciliadas.length}</span>
                <span className="text-[10px] text-muted-foreground">Encontradas e marcadas como "Pago"</span>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3 flex flex-col justify-center gap-0.5">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Transferências Detectadas</span>
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{localSuggestedTransfers.length}</span>
                <span className="text-[10px] text-muted-foreground">Saídas e Entradas cruzadas</span>
              </div>
              <div className="bg-pink-500/5 border border-pink-500/15 rounded-lg p-3 flex flex-col justify-center gap-0.5">
                <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider">Lançamentos Sem Match</span>
                <span className="text-2xl font-black text-pink-600 dark:text-pink-400">{localNaoEncontradas.length}</span>
                <span className="text-[10px] text-muted-foreground">Lançamentos isolados nos extratos</span>
              </div>
            </div>

            {/* Listas Principais */}
            <div className="flex-1 grid grid-cols-10 gap-4 min-h-0 font-sans">
              
              {/* Esquerda: Conciliadas + Transferências Sugeridas (6/10) */}
              <div className="col-span-6 flex flex-col min-h-0 space-y-4">
                
                {/* 1. Transferências Sugeridas */}
                {localSuggestedTransfers.length > 0 && (
                  <div className="border border-amber-500/20 bg-amber-500/5 rounded-lg flex flex-col max-h-[50%] min-h-0">
                    <div className="p-3 border-b border-amber-500/10 flex items-center justify-between shrink-0 bg-amber-500/10">
                      <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                        <ArrowLeftRight className="h-4 w-4" />
                        Transferências Internas Detectadas ({localSuggestedTransfers.length})
                      </span>
                      <Button
                        size="sm"
                        onClick={handleLancarTodasTransferencias}
                        disabled={isBulkLaunching}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] h-7 px-3 flex items-center gap-1.5"
                      >
                        {isBulkLaunching ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Confirmar Todas
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                      {localSuggestedTransfers.map((item) => (
                        <div key={item.id} className="border border-amber-500/20 bg-background rounded-lg p-3 space-y-3 relative hover:shadow-md transition-shadow">
                          {/* Design Visual do Fluxo da Transferência */}
                          <div className="flex items-center gap-2 justify-between">
                            {/* Origem (Saída) */}
                            <div className="flex-1 min-w-0 p-2 bg-red-500/5 border border-red-500/10 rounded-md">
                              <span className="text-[9px] font-bold text-red-500 uppercase">Saída</span>
                              <p className="text-xs font-semibold truncate text-foreground">{item.origem.conta_nome}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{item.origem.descricao}</p>
                            </div>

                            {/* Seta de Ligação */}
                            <div className="flex flex-col items-center gap-1 text-amber-500 shrink-0 px-1.5">
                              <ArrowLeftRight className="h-4 w-4 animate-pulse" />
                              <span className="text-[10px] font-extrabold">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                              </span>
                            </div>

                            {/* Destino (Entrada) */}
                            <div className="flex-1 min-w-0 p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-md">
                              <span className="text-[9px] font-bold text-emerald-500 uppercase">Entrada</span>
                              <p className="text-xs font-semibold truncate text-foreground">{item.destino.conta_nome}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{item.destino.descricao}</p>
                            </div>
                          </div>

                          {/* Campo de Descrição Customizada */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <input
                                type="text"
                                value={customDescriptions[item.id] !== undefined ? customDescriptions[item.id] : item.descricao}
                                onChange={(e) => setCustomDescriptions(prev => ({ ...prev, [item.id]: e.target.value }))}
                                className="w-full text-xs font-medium bg-muted/50 border rounded px-2 py-1 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                placeholder="Descrição da transferência..."
                              />
                            </div>
                            
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleIgnorarTransferenciaSugerida(item)}
                                className="text-xs h-7 text-muted-foreground hover:text-red-500 font-semibold"
                              >
                                Separar
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleLancarTransferenciaSugerida(item)}
                                disabled={lancarMutation.isPending}
                                className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] h-7 px-3.5 font-bold flex items-center gap-1"
                              >
                                <Check className="h-3 w-3" />
                                Lançar
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Reconciliadas Automaticamente */}
                <div className="border rounded-lg flex flex-col flex-1 min-h-0 bg-background/50">
                  <div className="p-3 border-b bg-emerald-500/5 flex items-center justify-between shrink-0">
                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      Automaticamente Conciliadas ({localConciliadas.length})
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                    {localConciliadas.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground py-8">
                        Nenhuma transação conciliada de forma automática ainda.
                      </div>
                    ) : (
                      localConciliadas.map((item, idx) => (
                        <div key={idx} className="border border-emerald-500/10 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-lg p-2.5 text-xs space-y-1">
                          <div className="flex justify-between font-semibold">
                            <span className="truncate">{item.transacao.descricao}</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.transacao.valor)}
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground items-center">
                            <span>Data Kakebo: {format(new Date(item.transacao.data_transacao), 'dd/MM/yyyy')}</span>
                            <div className="flex gap-2 items-center">
                              <span className="italic text-emerald-500/80">Extrato: {item.ofx.descricao}</span>
                              {item.alreadyPaid && (
                                <span className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 px-1 py-0.5 rounded text-[8px] font-black uppercase">
                                  Lançado Prévio
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Direita: Outros Lançamentos Sem Correspondência (4/10) */}
              <div className="col-span-4 border rounded-lg flex flex-col min-h-0 bg-background/50">
                <div className="p-3 border-b bg-pink-500/5 flex items-center justify-between shrink-0">
                  <span className="text-xs font-extrabold text-pink-600 dark:text-pink-400 flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4" />
                    Lançamentos Sem Match ({localNaoEncontradas.length})
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
                  {localNaoEncontradas.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground p-6 text-center gap-1">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-1" />
                      <strong>Tudo reconciliado!</strong>
                      <span>Nenhum lançamento restante sem conciliação.</span>
                    </div>
                  ) : (
                    localNaoEncontradas.map((item) => {
                      const itemKey = `${item.descricao}-${item.data}-${item.valor}-${item.conta_id}`;
                      const currentType = transactionTypes[itemKey] || item.tipo;
                      const currentDesc = customDescriptions[itemKey] !== undefined ? customDescriptions[itemKey] : item.descricao;

                      const filteredSubcategories = subcategoriasList.filter(
                        sub => sub.categoriaTipo === currentType
                      );

                      return (
                        <div key={itemKey} className="border border-border bg-muted/20 hover:bg-muted/40 rounded-lg p-3 text-xs space-y-2.5 transition-colors">
                          {/* Tag da Conta do OFX */}
                          <div className="flex items-center justify-between">
                            <span className="bg-muted px-2 py-0.5 rounded text-[9px] font-semibold text-muted-foreground uppercase">
                              🏦 {item.conta_nome}
                            </span>
                            <span className={currentType === 'Despesa' ? 'text-red-500 font-bold text-xs' : currentType === 'Receita' ? 'text-green-500 font-bold text-xs' : 'text-amber-500 font-bold text-xs'}>
                              {currentType === 'Despesa' ? '-' : currentType === 'Receita' ? '+' : '⇆'}
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor)}
                            </span>
                          </div>

                          {/* Edição de Descrição Customizável */}
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground font-semibold">Descrição do Lançamento</Label>
                            <input
                              type="text"
                              value={currentDesc}
                              onChange={(e) => setCustomDescriptions(prev => ({ ...prev, [itemKey]: e.target.value }))}
                              className="w-full text-xs font-semibold bg-background border rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                              placeholder="Digite a descrição..."
                            />
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                            <span>Data Extrato: {format(new Date(item.data), 'dd/MM/yyyy')}</span>
                          </div>

                          {/* Seletor Dinâmico de Tipo e Categoria */}
                          <div className="flex items-center gap-2 border-t pt-2.5">
                            <div className="flex items-center gap-1 min-w-0">
                              <select
                                value={currentType}
                                onChange={(e) => handleTypeChange(itemKey, e.target.value as any)}
                                className="text-[10px] bg-background border rounded px-1.5 py-0.5 focus:outline-none font-bold"
                              >
                                <option value="Despesa">Despesa</option>
                                <option value="Receita">Receita</option>
                                <option value="Transferencia">Transferência</option>
                              </select>
                            </div>

                            {/* Dropdown de Subcategoria ou Seletor de Conta de Destino se for Transferência */}
                            <div className="flex-1 min-w-0">
                              {currentType === 'Transferencia' ? (
                                <select
                                  value={selectedDestinationAccounts[itemKey] || ''}
                                  onChange={(e) => setSelectedDestinationAccounts(prev => ({ ...prev, [itemKey]: e.target.value }))}
                                  className="w-full text-[10px] bg-amber-500/5 border border-amber-500/30 rounded-md px-1 py-0.5 focus:outline-none text-foreground font-semibold"
                                >
                                  <option value="" disabled>
                                    {item.tipo === 'Receita' ? 'Conta Origem' : 'Conta Destino'}
                                  </option>
                                  {contas
                                    .filter(c => c.id !== item.conta_id)
                                    .map(c => (
                                      <option key={c.id} value={c.id!}>
                                        {c.nome} ({c.tipo})
                                      </option>
                                    ))}
                                </select>
                              ) : (
                                <select
                                  value={selectedSubcategories[itemKey] || ''}
                                  onChange={(e) => setSelectedSubcategories(prev => ({ ...prev, [itemKey]: e.target.value }))}
                                  className="w-full text-[10px] bg-background border rounded-md px-1 py-0.5 focus:outline-none text-foreground"
                                >
                                  <option value="" disabled>Subcategoria...</option>
                                  {filteredSubcategories.map(sub => (
                                    <option key={sub.id} value={sub.id}>
                                      {sub.categoriaNome} › {sub.nome}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            <Button
                              size="sm"
                              onClick={() => handleLancarAvulso(item)}
                              disabled={lancarMutation.isPending}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] h-6 px-2 font-bold flex items-center gap-1 shrink-0"
                            >
                              <Plus className="h-3 w-3" />
                              Lançar
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2 border-t mt-auto shrink-0">
              <Button
                onClick={() => setOpen(false)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 h-9 text-xs"
              >
                Concluir Conciliação
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
