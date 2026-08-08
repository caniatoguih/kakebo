import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmActionDialog } from './ConfirmActionDialog';

describe('ConfirmActionDialog', () => {
  it('exige o texto reforçado antes de liberar uma exclusão crítica', () => {
    const onConfirm = vi.fn();
    render(<ConfirmActionDialog
      open
      title="Excluir conta?"
      description="A conta será removida."
      impact="As movimentações também serão afetadas."
      confirmationText="Conta principal"
      onOpenChange={vi.fn()}
      onConfirm={onConfirm}
    />);

    const confirmButton = screen.getByRole('button', { name: 'Confirmar exclusão' });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Digite/), { target: { value: 'Conta principal' } });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
