import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function AccountCardsSkeleton() {
  return <div role="status" aria-label="Carregando contas" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {[0, 1, 2].map((item) => <Card key={item}><CardContent className="space-y-4 p-5"><div className="flex justify-between"><Skeleton className="h-5 w-32" /><Skeleton className="h-8 w-8 rounded-full" /></div><Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-40" /><Skeleton className="h-2 w-full" /></CardContent></Card>)}
    <span className="sr-only">Carregando contas...</span>
  </div>;
}
