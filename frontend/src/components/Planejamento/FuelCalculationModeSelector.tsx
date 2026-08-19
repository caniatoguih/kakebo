import { Button } from '@/components/ui/button';

export type FuelCalculationMode = 'rotina' | 'viagem';

interface FuelCalculationModeSelectorProps {
  value: FuelCalculationMode;
  onChange: (value: FuelCalculationMode) => void;
}

export function FuelCalculationModeSelector({ value, onChange }: FuelCalculationModeSelectorProps) {
  return (
    <section className="rounded-xl border bg-white/70 p-4" aria-label="Tipo de cálculo">
      <p className="text-sm font-medium">O que você deseja calcular?</p>
      <p className="mb-3 text-xs text-muted-foreground">Escolha a situação antes de informar os dados do percurso.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={value === 'rotina' ? 'default' : 'outline'} onClick={() => onChange('rotina')}>Rotina mensal</Button>
        <Button type="button" variant={value === 'viagem' ? 'default' : 'outline'} onClick={() => onChange('viagem')}>Viagem específica</Button>
      </div>
    </section>
  );
}
