import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BudgetComparisonChart } from './BudgetComparisonChart';

describe('BudgetComparisonChart', () => {
  it('expõe a comparação financeira também como texto acessível', () => {
    render(<BudgetComparisonChart data={[{ name: 'Cultura', Orcado: 500, Realizado: 250, fillOrcado: '#aaa', fillRealizado: '#111' }]} />);
    expect(screen.getByRole('figure')).toHaveAccessibleName(/Comparação entre valores orçados/);
    expect(screen.getByText(/Cultura: orçado R\$ 500,00; realizado R\$ 250,00/)).toBeInTheDocument();
  });
});
