import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Transacoes } from './Transacoes';
import { transacoesService } from '@/services/transacoesService';

vi.mock('@/services/transacoesService', () => ({
  transacoesService: {
    listar: vi.fn(), toggleStatus: vi.fn(), excluir: vi.fn(), excluirEmLote: vi.fn(),
  },
}));
vi.mock('@/services/contasService', () => ({ contasService: { listar: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/services/categoriasService', () => ({ categoriasService: { listar: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/components/Transacoes/NovaTransacaoModal', () => ({ NovaTransacaoModal: () => null }));
vi.mock('@/components/FeedbackHost', () => ({ notify: vi.fn() }));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/transacoes?periodo=Personalizado']}><Transacoes /></MemoryRouter></QueryClientProvider>);
}

describe('filtro de período personalizado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(transacoesService.listar).mockResolvedValue({ transacoes: [], total: 0 });
  });

  it('mantém as datas em edição e consulta somente depois de aplicar', async () => {
    renderPage();
    await waitFor(() => expect(transacoesService.listar).toHaveBeenCalledTimes(1));
    vi.mocked(transacoesService.listar).mockClear();

    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-08-31' } });
    expect(screen.getByLabelText('Data inicial')).toHaveValue('2026-08-01');
    expect(screen.getByLabelText('Data final')).toHaveValue('2026-08-31');
    expect(transacoesService.listar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));
    await waitFor(() => expect(transacoesService.listar).toHaveBeenCalledWith(expect.objectContaining({ inicio: '2026-08-01', fim: '2026-08-31' })));
  });
});
