import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FuelType = 'Gasolina' | 'Etanol' | 'Diesel';
type FuelPriceValues = Record<'gasolinaPrice' | 'etanolPrice' | 'dieselPrice', string>;

interface FuelPriceSettingsProps {
  selectedFuelType: string;
  selectedPrice: string;
  values: FuelPriceValues;
  onChange: (key: keyof FuelPriceValues, value: string) => void;
  onSave: () => void;
  saving: boolean;
}

const fields: Array<{ type: FuelType; key: keyof FuelPriceValues }> = [
  { type: 'Gasolina', key: 'gasolinaPrice' },
  { type: 'Etanol', key: 'etanolPrice' },
  { type: 'Diesel', key: 'dieselPrice' },
];

export function FuelPriceSettings({ selectedFuelType, selectedPrice, values, onChange, onSave, saving }: FuelPriceSettingsProps) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-xl border bg-white/70 p-4" aria-label="Preços de combustível">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Combustível do veículo</p>
          <p className="text-xs text-muted-foreground">{selectedFuelType} · R$ {selectedPrice || '0,00'}/L</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setOpen((current) => !current)}>{open ? 'Fechar preços' : 'Gerenciar preços'}</Button>
      </div>
      {open && <div className="mt-4 space-y-3 border-t pt-4"><div className="grid gap-3 md:grid-cols-3">
        {fields.map(({ type, key }) => <div className="space-y-2" key={key}><Label htmlFor={key}>{type} (R$/L)</Label><Input id={key} inputMode="decimal" value={values[key]} onChange={(event) => onChange(key, event.target.value)} /></div>)}
      </div><div className="flex justify-end"><Button type="button" disabled={saving} onClick={onSave}>{saving ? 'Salvando...' : 'Salvar preços'}</Button></div></div>}
    </section>
  );
}
