import { Fuel } from 'lucide-react';
import { CalculadoraCombustivel } from '@/components/Planejamento/CalculadoraCombustivel';

export function ConsumoCombustivel(): React.ReactElement {
  return <div className="space-y-6">
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Fuel className="h-6 w-6" /></div>
      <div><h1 className="text-3xl font-bold tracking-tight">Consumo de Combustível</h1><p className="text-muted-foreground">Planeje rotinas e viagens, salve cenários e provisione lançamentos futuros.</p></div>
    </div>
    <CalculadoraCombustivel />
  </div>;
}
