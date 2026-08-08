import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function TransactionListSkeleton() {
  return <Card role="status" aria-label="Carregando lançamentos"><CardContent className="space-y-4 p-5">
    {[0, 1, 2, 3, 4].map((item) => <div key={item} className="flex items-center gap-4 border-b pb-4 last:border-0 last:pb-0"><Skeleton className="h-4 w-4" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/2" /></div><Skeleton className="h-5 w-24" /></div>)}
    <span className="sr-only">Carregando lançamentos...</span>
  </CardContent></Card>;
}
