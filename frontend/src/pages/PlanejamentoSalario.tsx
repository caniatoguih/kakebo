import { Building2 } from 'lucide-react';
import { PlanejamentoSalarialPanel } from '@/components/Planejamento/PlanejamentoSalarialPanel';

export function PlanejamentoSalario(): React.ReactElement {
  return <div className="space-y-6">
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Building2 className="h-6 w-6" /></div>
      <div><h1 className="text-3xl font-bold tracking-tight">Planejamento Salarial</h1><p className="text-muted-foreground">Projete salário, férias, bônus e 13º e provisione os recebimentos futuros.</p></div>
    </div>
    <PlanejamentoSalarialPanel />
  </div>;
}
