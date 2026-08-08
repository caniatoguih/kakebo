import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Props = {
  open: boolean;
  title: string;
  description: string;
  impact?: string;
  confirmLabel?: string;
  pending?: boolean;
  confirmationText?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ConfirmActionDialog({
  open,
  title,
  description,
  impact,
  confirmLabel = 'Confirmar exclusão',
  pending = false,
  confirmationText,
  onOpenChange,
  onConfirm,
}: Props) {
  const [typedConfirmation, setTypedConfirmation] = useState('');
  useEffect(() => { if (!open) setTypedConfirmation(''); }, [open]);
  const confirmationMatches = !confirmationText || typedConfirmation.trim() === confirmationText;

  return <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-rose-700"><TriangleAlert className="h-5 w-5" />{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {impact && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Impacto:</strong> {impact}</div>}
      {confirmationText && <div className="space-y-2">
        <Label htmlFor="destructive-confirmation">Digite <strong>{confirmationText}</strong> para confirmar</Label>
        <Input id="destructive-confirmation" autoComplete="off" value={typedConfirmation} onChange={(event) => setTypedConfirmation(event.target.value)} />
      </div>}
      <DialogFooter>
        <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button variant="destructive" disabled={pending || !confirmationMatches} onClick={onConfirm}>{pending ? 'Processando...' : confirmLabel}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
