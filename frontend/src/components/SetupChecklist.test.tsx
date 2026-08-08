import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SetupChecklist } from './SetupChecklist';

describe('SetupChecklist', () => {
  it('mostra o progresso e somente as ações pendentes', () => {
    render(<MemoryRouter><SetupChecklist hasAccount hasCategory hasBudget={false} hasTransaction={false} /></MemoryRouter>);
    expect(screen.getByText('2 de 4')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Começar' })).toHaveLength(2);
    expect(screen.getByText('Planeje o mês')).toBeInTheDocument();
  });

  it('some quando a configuração está completa', () => {
    const { container } = render(<MemoryRouter><SetupChecklist hasAccount hasCategory hasBudget hasTransaction /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
