import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ContentGridSkeleton({ items = 4 }: { items?: number }) {
  return <div role="status" aria-label="Carregando conteúdo" className="grid gap-4 md:grid-cols-2">
    {Array.from({ length: items }, (_, item) => <Card key={item}><CardContent className="space-y-4 p-5"><Skeleton className="h-5 w-2/5" /><Skeleton className="h-3 w-4/5" /><Skeleton className="h-24 w-full" /></CardContent></Card>)}
    <span className="sr-only">Carregando conteúdo...</span>
  </div>;
}
