import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaStatus } from './PwaStatus';

const { updateServiceWorker } = vi.hoisted(() => ({ updateServiceWorker: vi.fn() }));
vi.mock('virtual:pwa-register', () => ({ registerSW: () => updateServiceWorker }));

describe('PwaStatus', () => {
  beforeEach(() => {
    updateServiceWorker.mockClear();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('informa quando a conexão é perdida', () => {
    render(<PwaStatus />);
    act(() => window.dispatchEvent(new Event('offline')));
    expect(screen.getByRole('status')).toHaveTextContent('Você está offline');
    act(() => window.dispatchEvent(new Event('online')));
    expect(screen.queryByText(/Você está offline/)).not.toBeInTheDocument();
  });

  it('oferece atualização explícita quando há uma nova versão', () => {
    render(<PwaStatus />);
    act(() => window.dispatchEvent(new Event('kakebo:pwa-update')));
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
