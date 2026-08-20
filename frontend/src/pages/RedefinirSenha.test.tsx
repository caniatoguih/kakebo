import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { RedefinirSenha } from './RedefinirSenha';
import { ThemeProvider } from '@/contexts/ThemeContext';

describe('RedefinirSenha', () => {
  it('orienta a solicitar outro link quando o token está ausente', () => {
    render(<ThemeProvider><MemoryRouter initialEntries={['/redefinir-senha']}><RedefinirSenha /></MemoryRouter></ThemeProvider>);

    expect(screen.getByRole('alert')).toHaveTextContent('link de recuperação está incompleto');
    expect(screen.getByRole('link', { name: 'Solicitar novo link' })).toHaveAttribute('href', '/esqueci-senha');
  });

  it('exibe os campos de nova senha quando o token tem formato válido', () => {
    render(<ThemeProvider><MemoryRouter initialEntries={[`/redefinir-senha?token=${'a'.repeat(64)}`]}><RedefinirSenha /></MemoryRouter></ThemeProvider>);

    expect(screen.getByLabelText('Nova senha')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirme a nova senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Redefinir senha' })).toBeEnabled();
  });
});
