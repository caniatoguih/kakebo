import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  title?: string;
  description?: string;
  retrying?: boolean;
  onRetry: () => void;
  className?: string;
  error?: unknown;
};

export function QueryErrorState({
  title = 'Não foi possível carregar os dados.',
  description = 'Verifique sua conexão e tente novamente.',
  retrying = false,
  onRetry,
  className,
  error,
}: Props) {
  const status = (error as any)?.response?.status;
  const unavailable = !!error && !(error as any)?.response;
  const resolvedTitle = status === 401 ? 'Sua sessão expirou.' : unavailable ? 'Serviço temporariamente indisponível.' : title;
  const resolvedDescription = status === 401 ? 'Entre novamente para continuar com segurança.' : unavailable ? 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.' : description;
  return <div role="alert" className={cn('flex flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50/60 px-6 py-10 text-center dark:border-rose-900/50 dark:bg-rose-950/20', className)}>
    <AlertCircle className="h-7 w-7 text-rose-600" />
    <div><p className="font-semibold text-rose-700 dark:text-rose-300">{resolvedTitle}</p><p className="mt-1 text-sm text-muted-foreground">{resolvedDescription}</p></div>
    <Button variant="outline" disabled={retrying} onClick={onRetry} className="gap-2">
      <RefreshCw className={cn('h-4 w-4', retrying && 'animate-spin')} />
      {retrying ? 'Tentando novamente...' : 'Tentar novamente'}
    </Button>
  </div>;
}
