import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryErrorState } from './QueryErrorState';

describe('QueryErrorState', () => {
  it('oferece recuperação e comunica a nova tentativa', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<QueryErrorState title="Falha ao carregar" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(<QueryErrorState title="Falha ao carregar" retrying onRetry={onRetry} />);
    expect(screen.getByRole('button', { name: 'Tentando novamente...' })).toBeDisabled();
  });

  it('diferencia indisponibilidade do servidor de erro comum', () => {
    render(<QueryErrorState error={new Error('Network Error')} onRetry={() => undefined} />);
    expect(screen.getByText('Serviço temporariamente indisponível.')).toBeInTheDocument();
    expect(screen.getByText(/Não foi possível conectar/)).toBeInTheDocument();
  });
});
