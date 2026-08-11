import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AjustarValorRecorrenciaModal } from './AjustarValorRecorrenciaModal';

const mocks = vi.hoisted(() => ({ obter: vi.fn(), simular: vi.fn(), alterar: vi.fn() }));
vi.mock('@/services/recorrenciasService', () => ({
  recorrenciasService: {
    obter: mocks.obter,
    simularAlteracao: mocks.simular,
    alterarValor: mocks.alterar,
  },
}));

const recurrence = {
  id: '11111111-1111-4111-8111-111111111111',
  descricao: 'Academia',
  tipo: 'Despesa' as const,
  valor_atual: 100,
  situacao: 'Ativa' as const,
  conta_origem: { id: 'account-id', nome: 'Cartão', tipo: 'CartaoCredito' as const },
  conta_destino: null,
  subcategoria: null,
  primeira_competencia: '2026-08',
  proxima_competencia: '2026-09',
  ultima_competencia: '2026-10',
  ocorrencias_geradas: 3,
  total_previsto: 300,
};

function renderModal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><AjustarValorRecorrenciaModal recurrence={recurrence} /></QueryClientProvider>);
}

describe('AjustarValorRecorrenciaModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.obter.mockResolvedValue({
      ...recurrence,
      ocorrencias: [
        { id: 'one', competencia: '2026-09', valor: 100, data_transacao: '2026-09-01T00:00:00.000Z', status: 'Pendente', conta: recurrence.conta_origem },
        { id: 'two', competencia: '2026-10', valor: 100, data_transacao: '2026-10-01T00:00:00.000Z', status: 'Pendente', conta: recurrence.conta_origem },
      ],
    });
    mocks.simular.mockResolvedValue({
      simulacao_id: 'a'.repeat(64), serie_id: recurrence.id, valor_atual: 100, novo_valor: 120,
      competencia_inicial: '2026-09', escopo: 'DestaCompetenciaEmDiante',
      ocorrencias_afetadas: 2, lancamentos_afetados: 2, diferenca_total: 40,
      contas_afetadas: ['account-id'], faturas_afetadas: ['invoice-id'], faturas_fechadas: [],
      competencias_bloqueadas: [], requer_confirmacao_fatura_fechada: false, pode_executar: true,
    });
    mocks.alterar.mockResolvedValue({ message: 'ok', ocorrencias_afetadas: 2, lancamentos_afetados: 2, faturas_recalculadas: 1 });
  });

  it('simula o impacto antes de confirmar a alteração', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: /Ajustar valor/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Revisar impacto/ })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: /Revisar impacto/ }));

    await waitFor(() => expect(mocks.simular).toHaveBeenCalledWith(recurrence.id, expect.objectContaining({
      competencia_inicial: '2026-09', escopo: 'DestaCompetenciaEmDiante',
    })));
    expect(screen.getByText('Simulação concluída')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.includes('R$ 40,00') === true)).toBeInTheDocument();
    expect(mocks.alterar).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar alteração' }));
    await waitFor(() => expect(mocks.alterar).toHaveBeenCalledWith(recurrence.id, expect.objectContaining({
      simulacao_id: 'a'.repeat(64), confirmar_faturas_fechadas: false,
    })));
  });

  it('não habilita confirmação quando a competência está protegida', async () => {
    mocks.simular.mockResolvedValueOnce({
      simulacao_id: 'b'.repeat(64), serie_id: recurrence.id, valor_atual: 100, novo_valor: 100,
      competencia_inicial: '2026-09', escopo: 'DestaCompetenciaEmDiante',
      ocorrencias_afetadas: 2, lancamentos_afetados: 2, diferenca_total: 0,
      contas_afetadas: ['account-id'], faturas_afetadas: [], faturas_fechadas: [],
      competencias_bloqueadas: [{ competencia: '2026-09', motivo: 'Lançamento já pago.' }],
      requer_confirmacao_fatura_fechada: false, pode_executar: false,
    });
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: /Ajustar valor/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Revisar impacto/ })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: /Revisar impacto/ }));

    expect(await screen.findByText('Alteração bloqueada')).toBeInTheDocument();
    expect(screen.getByText(/Lançamento já pago/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar alteração' })).toBeDisabled();
  });
});
