import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SpendingBreakdown } from './SpendingBreakdown';

const categories = [
  {
    id: 'sobrevivencia:moradia',
    name: 'Moradia',
    group: 'Sobrevivência',
    value: 750,
    subcategories: [
      { id: 'aluguel', name: 'Aluguel', value: 600 },
      { id: 'condominio', name: 'Condomínio', value: 150 },
    ],
  },
  {
    id: 'lazer:lazer',
    name: 'Lazer',
    group: 'Lazer',
    value: 250,
    subcategories: [
      { id: 'cinema', name: 'Cinema', value: 200 },
      { id: 'jogos', name: 'Jogos', value: 50 },
    ],
  },
];

describe('SpendingBreakdown', () => {
  it('seleciona uma categoria e detalha subcategorias em percentual e valor absoluto', async () => {
    const user = userEvent.setup();
    render(<SpendingBreakdown categories={categories} total={1000} />);

    expect(screen.getByRole('heading', { name: 'Moradia' })).toBeInTheDocument();
    expect(screen.getByText('Aluguel')).toBeInTheDocument();
    expect(screen.getByText('80,0%')).toBeInTheDocument();

    await user.click(within(screen.getByLabelText('Selecione uma categoria')).getByRole('button', { name: /Lazer/ }));

    expect(screen.getByRole('heading', { name: 'Lazer' })).toBeInTheDocument();
    expect(screen.getByText('Cinema')).toBeInTheDocument();
    expect(screen.getByText(/Cinema: 80,0% da categoria, equivalente a R\$\s*200,00/)).toBeInTheDocument();
  });
});
