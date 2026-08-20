import { useEffect, useState } from 'react';
import { Check, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Reflection = { learned: string; proud: string; improve: string };
const emptyReflection: Reflection = { learned: '', proud: '', improve: '' };

export function MonthlyReflection({ storageKey, monthLabel }: { storageKey: string; monthLabel: string }) {
  const [reflection, setReflection] = useState<Reflection>(emptyReflection);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setReflection(stored ? { ...emptyReflection, ...JSON.parse(stored) } : emptyReflection);
    } catch {
      setReflection(emptyReflection);
    }
    setSaved(false);
  }, [storageKey]);

  const update = (field: keyof Reflection, value: string) => {
    setReflection((current) => ({ ...current, [field]: value }));
    setSaved(false);
  };

  const save = () => {
    localStorage.setItem(storageKey, JSON.stringify(reflection));
    setSaved(true);
  };

  return <Card className="relative overflow-hidden border-primary/15 bg-secondary/35">
    <NotebookPen className="absolute -right-5 -top-5 h-28 w-28 text-primary/5" aria-hidden="true" />
    <CardHeader className="relative">
      <CardTitle>Reflexão do mês</CardTitle>
      <CardDescription>Registre aprendizados de {monthLabel}. Estas notas ficam salvas somente neste navegador.</CardDescription>
    </CardHeader>
    <CardContent className="relative space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-2"><Label htmlFor="reflection-learned">O que você aprendeu?</Label><Textarea id="reflection-learned" value={reflection.learned} onChange={(event) => update('learned', event.target.value)} placeholder="Um aprendizado sobre suas escolhas…" /></div>
        <div className="space-y-2"><Label htmlFor="reflection-proud">Do que você se orgulha?</Label><Textarea id="reflection-proud" value={reflection.proud} onChange={(event) => update('proud', event.target.value)} placeholder="Uma decisão que fez bem…" /></div>
        <div className="space-y-2"><Label htmlFor="reflection-improve">O que pode melhorar?</Label><Textarea id="reflection-improve" value={reflection.improve} onChange={(event) => update('improve', event.target.value)} placeholder="Um pequeno passo para o próximo mês…" /></div>
      </div>
      <div className="flex flex-col items-start justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
        <p className="text-xs text-muted-foreground">Suas anotações pessoais não alteram cálculos ou lançamentos.</p>
        <Button onClick={save} disabled={saved} className="w-full sm:w-auto">{saved ? <><Check />Reflexão salva</> : 'Salvar reflexão'}</Button>
      </div>
    </CardContent>
  </Card>;
}
