import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orcamentosService, type OrcamentoItem } from '@/services/orcamentosService';
import { NovoOrcamentoModal } from '@/components/Planejamento/NovoOrcamentoModal';
import { DesenharOrcamentoModal } from '@/components/Planejamento/DesenharOrcamentoModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Trash2, TrendingUp, Wallet, BookOpen, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ──────────────────────────────────────────────
// Pilar config: label, ícone, cor
// ──────────────────────────────────────────────
const PILAR_CONFIG = {
  Sobrevivencia: {
    label: 'Sobrevivência',
    icon: Wallet,
    color: 'from-emerald-50/50 to-emerald-100/30 border-emerald-200/60 dark:from-emerald-950/20 dark:to-emerald-950/10 dark:border-emerald-900/20',
    barBase: 'bg-emerald-600 dark:bg-emerald-500',
    border: 'border-emerald-200/60 dark:border-emerald-900/30',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  Lazer: {
    label: 'Lazer',
    icon: Sparkles,
    color: 'from-violet-50/50 to-violet-100/30 border-violet-200/60 dark:from-violet-950/20 dark:to-violet-950/10 dark:border-violet-900/20',
    barBase: 'bg-violet-600 dark:bg-violet-500',
    border: 'border-violet-200/60 dark:border-violet-900/30',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  },
  Cultura: {
    label: 'Cultura',
    icon: BookOpen,
    color: 'from-amber-50/50 to-amber-100/30 border-amber-200/60 dark:from-amber-950/20 dark:to-amber-950/10 dark:border-amber-900/20',
    barBase: 'bg-amber-600 dark:bg-amber-500',
    border: 'border-amber-200/60 dark:border-amber-900/30',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  Extras: {
    label: 'Extras / Imprevistos',
    icon: TrendingUp,
    color: 'from-rose-50/50 to-rose-100/30 border-rose-200/60 dark:from-rose-950/20 dark:to-rose-950/10 dark:border-rose-900/20',
    barBase: 'bg-rose-600 dark:bg-rose-500',
    border: 'border-rose-200/60 dark:border-rose-900/30',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
} as const;

type Pilar = keyof typeof PILAR_CONFIG;
const PILAR_ORDER: Pilar[] = ['Sobrevivencia', 'Lazer', 'Cultura', 'Extras'];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function progressColor(pct: number) {
  if (pct >= 100) return 'bg-rose-600 dark:bg-rose-500';
  if (pct >= 80) return 'bg-amber-500 dark:bg-amber-400';
  return undefined; // uses pilar default
}

function ProgressBar({ pct, pilar }: { pct: number; pilar: Pilar }) {
  const capped = Math.min(pct, 100);
  const color = progressColor(pct) ?? PILAR_CONFIG[pilar].barBase;
  return (
    <div className="relative h-2 w-full rounded-full bg-slate-200/80 dark:bg-slate-800/70 overflow-hidden shadow-inner">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${capped}%` }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// Pilar Card
// ──────────────────────────────────────────────
interface PilarCardProps {
  pilar: Pilar;
  items: OrcamentoItem[];
  mes: number;
  ano: number;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function PilarCard({ pilar, items, mes, ano, onDelete, isDeleting }: PilarCardProps) {
  const cfg = PILAR_CONFIG[pilar];
  const Icon = cfg.icon;

  const totalOrcado = items.reduce((s, i) => s + i.valor_orcado, 0);
  const totalRealizado = items.reduce((s, i) => s + i.valor_realizado, 0);
  const pctGeral = totalOrcado > 0 ? (totalRealizado / totalOrcado) * 100 : 0;

  return (
    <Card className={`border shadow-sm rounded-2xl overflow-hidden bg-gradient-to-br ${cfg.color} backdrop-blur-md transition-shadow duration-300 hover:shadow-md`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl shadow-sm ${cfg.badge}`}>
              <Icon className="h-4.5 w-4.5" />
            </div>
            <CardTitle className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">{cfg.label}</CardTitle>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full shadow-sm ${pctGeral >= 100 ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300' : pctGeral >= 80 ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : cfg.badge}`}>
            {pctGeral.toFixed(0)}%
          </span>
        </div>

        {/* Totais do pilar */}
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{brl(totalRealizado)} realizado</span>
            <span>{brl(totalOrcado)} orçado</span>
          </div>
          <ProgressBar pct={pctGeral} pilar={pilar} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0 pb-4">
        {items.map((item) => {
          const pct = item.valor_orcado > 0 ? (item.valor_realizado / item.valor_orcado) * 100 : 0;
          return (
            <div key={item.id} className="rounded-xl bg-background/95 dark:bg-slate-900/80 p-4 border border-slate-200/40 dark:border-slate-800/40 shadow-sm space-y-3 transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{item.subcategoria_nome}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <NovoOrcamentoModal
                    mes={mes}
                    ano={ano}
                    editItem={{
                      id: item.id,
                      subcategoria_id: item.subcategoria_id,
                      subcategoria_nome: item.subcategoria_nome,
                      valor_orcado: item.valor_orcado,
                    }}
                  />
                  <Button
                    variant={'ghost' as any}
                    size={'sm' as any}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    onClick={() => onDelete(item.id)}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <ProgressBar pct={pct} pilar={pilar} />
                <div className="flex justify-between text-xs font-semibold">
                  <span className={pct >= 100 ? 'text-rose-600 dark:text-rose-400 font-bold' : pct >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}>
                    {brl(item.valor_realizado)}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 font-medium">{brl(item.valor_orcado)}</span>
                </div>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 text-center py-4">
            Nenhum orçamento neste pilar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────
// Página principal
// ──────────────────────────────────────────────
export function Planejamento(): React.ReactElement {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const queryClient = useQueryClient();

  const mes = currentDate.getMonth() + 1;
  const ano = currentDate.getFullYear();

  const { data: orcamentos = [], isLoading, isError } = useQuery<OrcamentoItem[]>({
    queryKey: ['orcamentos', mes, ano],
    queryFn: () => orcamentosService.listar(mes, ano),
  });

  const deleteMutation = useMutation({
    mutationFn: orcamentosService.deletar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orcamentos', mes, ano] }),
  });

  // Agrupa por pilar
  const byPilar = useMemo(() => {
    const map = new Map<Pilar, OrcamentoItem[]>();
    PILAR_ORDER.forEach((p) => map.set(p, []));
    orcamentos.forEach((o) => {
      const pilar = o.pilar as Pilar;
      if (map.has(pilar)) map.get(pilar)!.push(o);
    });
    return map;
  }, [orcamentos]);

  // Totais gerais
  const totalOrcado = orcamentos.reduce((s, o) => s + o.valor_orcado, 0);
  const totalRealizado = orcamentos.reduce((s, o) => s + o.valor_realizado, 0);
  const saldo = totalOrcado - totalRealizado;

  const prevMonth = () => setCurrentDate(new Date(ano, mes - 2, 1));
  const nextMonth = () => setCurrentDate(new Date(ano, mes, 1));

  const mesLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR });
  const mesCapitalized = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planejamento</h1>
          <p className="text-muted-foreground">Orçado × Realizado por pilar Kakebo.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Navegação de mês */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1">
            <Button variant={'ghost' as any} size={'sm' as any} onClick={prevMonth} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[130px] text-center text-sm font-semibold">{mesCapitalized}</span>
            <Button variant={'ghost' as any} size={'sm' as any} onClick={nextMonth} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <DesenharOrcamentoModal mes={mes} ano={ano} />
          <NovoOrcamentoModal mes={mes} ano={ano} />
        </div>
      </div>

      {/* Resumo do mês */}
      {orcamentos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Orçado</p>
              <p className="text-2xl font-bold">{brl(totalOrcado)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Realizado</p>
              <p className={`text-2xl font-bold ${totalRealizado > totalOrcado ? 'text-red-400' : 'text-foreground'}`}>
                {brl(totalRealizado)}
              </p>
            </CardContent>
          </Card>
          <Card className={`border-border ${saldo >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                {saldo >= 0 ? 'Margem Disponível' : 'Excedente'}
              </p>
              <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {brl(Math.abs(saldo))}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Estados de carregamento / erro / vazio */}
      {isLoading && (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          Carregando orçamentos...
        </div>
      )}
      {isError && (
        <div className="flex items-center justify-center h-48 text-destructive">
          Erro ao carregar. Verifique sua conexão / token JWT.
        </div>
      )}
      {!isLoading && !isError && orcamentos.length === 0 && (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
            <Wallet className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm font-medium">Nenhum orçamento cadastrado para {mesCapitalized}.</p>
            <div className="flex items-center gap-2.5">
              <DesenharOrcamentoModal mes={mes} ano={ano} />
              <NovoOrcamentoModal mes={mes} ano={ano} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid de pilares */}
      {!isLoading && !isError && orcamentos.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {PILAR_ORDER.map((pilar) => (
            <PilarCard
              key={pilar}
              pilar={pilar}
              items={byPilar.get(pilar) ?? []}
              mes={mes}
              ano={ano}
              onDelete={(id) => deleteMutation.mutate(id)}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
