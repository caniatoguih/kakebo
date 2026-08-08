import { CheckCircle2, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Step = { label: string; description: string; path: string; complete: boolean };
type Props = { hasAccount: boolean; hasCategory: boolean; hasBudget: boolean; hasTransaction: boolean };

export function SetupChecklist({ hasAccount, hasCategory, hasBudget, hasTransaction }: Props) {
  const steps: Step[] = [
    { label: 'Cadastre uma conta', description: 'Informe onde seu dinheiro fica.', path: '/contas', complete: hasAccount },
    { label: 'Revise suas categorias', description: 'Adapte as classificações à sua rotina.', path: '/categorias', complete: hasCategory },
    { label: 'Planeje o mês', description: 'Defina limites para cada pilar Kakebo.', path: '/planejamento', complete: hasBudget },
    { label: 'Registre uma movimentação', description: 'Adicione sua primeira receita ou despesa.', path: '/transacoes', complete: hasTransaction },
  ];
  const completed = steps.filter((step) => step.complete).length;
  if (completed === steps.length) return null;

  return <Card className="border-primary/30 bg-primary/5">
    <CardHeader><CardTitle className="flex items-center justify-between gap-3"><span>Prepare seu Kakebo</span><span className="text-sm font-medium text-muted-foreground">{completed} de {steps.length}</span></CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${(completed / steps.length) * 100}%` }} /></div>
      <ol className="grid gap-3 md:grid-cols-2">
        {steps.map((step) => <li key={step.path} className="flex items-start gap-3 rounded-lg border bg-background p-3">
          {step.complete ? <CheckCircle2 aria-label="Concluído" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <Circle aria-label="Pendente" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
          <div className="min-w-0 flex-1"><p className="font-medium">{step.label}</p><p className="text-xs text-muted-foreground">{step.description}</p></div>
          {!step.complete && <Button asChild size="sm" variant="outline"><Link to={step.path}>Começar</Link></Button>}
        </li>)}
      </ol>
    </CardContent>
  </Card>;
}
