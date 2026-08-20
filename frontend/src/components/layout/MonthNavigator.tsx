import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type MonthNavigatorProps = {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  loading?: boolean;
};

export function MonthNavigator({ label, onPrevious, onNext, loading = false }: MonthNavigatorProps) {
  return <div className="inline-flex w-full items-center justify-between rounded-md border border-primary/15 bg-card p-1 shadow-card sm:w-auto" aria-label={`Período selecionado: ${label}`}>
    <Button aria-label="Mês anterior" variant="ghost" size="icon" onClick={onPrevious} disabled={loading}>
      <ChevronLeft aria-hidden="true" />
    </Button>
    <span className="min-w-36 px-2 text-center font-display text-sm font-semibold capitalize" aria-live="polite">
      {loading ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Atualizando</span> : label}
    </span>
    <Button aria-label="Próximo mês" variant="ghost" size="icon" onClick={onNext} disabled={loading}>
      <ChevronRight aria-hidden="true" />
    </Button>
  </div>;
}
