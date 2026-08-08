import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackHost, notify } from './FeedbackHost';

describe('FeedbackHost', () => {
  it('exibe e fecha uma mensagem integrada', () => {
    render(<FeedbackHost />);
    act(() => notify('Operação concluída', 'success'));
    expect(screen.getByRole('status')).toHaveTextContent('Operação concluída');
    fireEvent.click(screen.getByRole('button', { name: /Fechar aviso/ }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('mantém mensagens simultâneas em uma fila visível', () => {
    render(<FeedbackHost />);
    act(() => {
      notify('Primeira mensagem', 'success');
      notify('Atenção necessária', 'warning');
      notify('Falha recuperável', 'error');
    });

    expect(screen.getByText('Primeira mensagem')).toBeInTheDocument();
    expect(screen.getByText('Atenção necessária')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Falha recuperável');
  });

  it('executa uma ação segura oferecida pela notificação', () => {
    const undo = vi.fn();
    render(<FeedbackHost />);
    act(() => notify('Status alterado', 'success', { label: 'Desfazer', onClick: undo }));
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(undo).toHaveBeenCalledOnce();
    expect(screen.queryByText('Status alterado')).not.toBeInTheDocument();
  });
});
