import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './ThemeToggle';
import { ThemeProvider } from '@/contexts/ThemeContext';

describe('ThemeToggle', () => {
  afterEach(() => {
    localStorage.removeItem('kakebo:theme');
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
  });

  it('alterna para o tema escuro e persiste a preferência', async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);

    await user.click(screen.getByRole('button', { name: 'Usar tema escuro' }));

    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(localStorage.getItem('kakebo:theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Usar tema claro' })).toBeInTheDocument();
  });
});
