import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FluxoContabil } from './FluxoContabil';

const mocks = vi.hoisted(() => ({ obterFluxoContabil: vi.fn(), listarContas: vi.fn() }));

vi.mock('@/services/transacoesService', () => ({
  transacoesService: { obterFluxoContabil: mocks.obterFluxoContabil },
}));

vi.mock('@/services/contasService', () => ({
  contasService: { listar: mocks.listarContas },
}));

const report = {
  meses: ['2026-07', '2026-08'],
  entradas: [{
    categoria_nome: 'Rendimentos',
    valores: { '2026-07': 5000, '2026-08': 6500 },
    subcategorias: [{ subcategoria_nome: 'Salário', valores: { '2026-07': 5000, '2026-08': 6500 } }],
  }],
  total_entradas: { '2026-07': 5000, '2026-08': 6500 },
  saidas: [{
    categoria_nome: 'Moradia',
    valores: { '2026-07': 1700, '2026-08': 1800 },
    subcategorias: [{ subcategoria_nome: 'Aluguel', valores: { '2026-07': 1700, '2026-08': 1800 } }],
  }],
  total_saidas: { '2026-07': 1700, '2026-08': 1800 },
  saldo_mes: { '2026-07': 3300, '2026-08': 4700 },
  saldo_anterior: { '2026-07': 1000, '2026-08': 4300 },
  saldo_acumulado: { '2026-07': 4300, '2026-08': 9000 },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><FluxoContabil /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FluxoContabil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date('2026-08-11T12:00:00Z'));
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    mocks.obterFluxoContabil.mockResolvedValue(report);
    mocks.listarContas.mockResolvedValue([]);
  });

  it('oferece resumo mensal navegável e detalhamento acessível no mobile', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const user = userEvent.setup();
    renderPage();

    const mobileSummary = await screen.findByRole('region', { name: 'Resumo mensal do fluxo contábil' });
    expect(mocks.obterFluxoContabil).toHaveBeenCalledWith('2026-08', '2026-08', 'Ambos', undefined);
    expect(screen.getByLabelText('Mês')).toHaveTextContent('Ago 2026');
    expect(screen.getByLabelText('Modo Período').parentElement).toHaveClass('hidden');
    expect(mobileSummary).toHaveClass('md:hidden');
    expect(within(mobileSummary).getByRole('heading', { name: 'Ago 2026' })).toBeInTheDocument();

    const housing = within(mobileSummary).getByRole('button', { name: /Moradia/ });
    expect(housing).toHaveAttribute('aria-expanded', 'false');
    await user.click(housing);
    expect(housing).toHaveAttribute('aria-expanded', 'true');
    expect(within(mobileSummary).getByText('Aluguel')).toBeInTheDocument();

    await user.click(within(mobileSummary).getByRole('button', { name: 'Ver mês anterior' }));
    expect(within(mobileSummary).getByRole('heading', { name: 'Jul 2026' })).toBeInTheDocument();
  });

  it('mantém a matriz completa reservada para desktop', async () => {
    renderPage();
    await screen.findByRole('region', { name: 'Resumo mensal do fluxo contábil' });
    expect(document.querySelector('#dfc-table-container')).toHaveClass('hidden', 'md:block');
    expect(screen.getByRole('columnheader', { name: 'Descrição Contábil' })).toBeInTheDocument();
  });
});
