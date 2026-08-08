import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Layout } from './Layout';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ usuario: { nome: 'Pessoa Teste', email: 'teste@kakebo.local' }, logout: vi.fn() }),
}));

describe('Layout', () => {
  it('indica a localização e o destino ativo na navegação mobile', () => {
    render(<MemoryRouter initialEntries={['/planejamento']}><Routes><Route path="/" element={<Layout />}><Route path="planejamento" element={<div>Conteúdo</div>} /></Route></Routes></MemoryRouter>);
    expect(screen.getByText('Você está em')).toBeInTheDocument();
    expect(screen.getAllByText('Planejamento').length).toBeGreaterThan(0);
    const mobileNavigation = screen.getByRole('navigation', { name: 'Navegação principal mobile' });
    expect(within(mobileNavigation).getByRole('link', { name: /Planejar/ })).toHaveAttribute('aria-current', 'page');
    expect(within(mobileNavigation).getAllByRole('link')).toHaveLength(4);
  });
});
