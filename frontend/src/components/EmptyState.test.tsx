import { render, screen } from '@testing-library/react';
import { Wallet } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('explica o próximo passo e exibe sua ação', () => {
    render(<EmptyState icon={Wallet} title="Cadastre sua primeira conta" description="Uma conta é necessária para começar." action={<button>Adicionar conta</button>} />);
    expect(screen.getByRole('heading', { name: 'Cadastre sua primeira conta' })).toBeInTheDocument();
    expect(screen.getByText('Uma conta é necessária para começar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar conta' })).toBeInTheDocument();
  });
});
