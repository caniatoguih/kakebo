import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NovaTransacaoModal } from './NovaTransacaoModal';

const mocks = vi.hoisted(() => ({
  criar: vi.fn(),
  editar: vi.fn(),
  contas: vi.fn(),
  categorias: vi.fn(),
}));

vi.mock('@/services/transacoesService', () => ({
  transacoesService: { criar: mocks.criar, editar: mocks.editar },
}));
vi.mock('@/services/contasService', () => ({
  contasService: { listar: mocks.contas },
}));
vi.mock('@/services/categoriasService', () => ({
  categoriasService: { listar: mocks.categorias },
}));

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <NovaTransacaoModal />
    </QueryClientProvider>,
  );
}

async function chooseSelect(index: number, option: string | RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getAllByRole('combobox')[index]);
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('NovaTransacaoModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.contas.mockResolvedValue([
      { id: '11111111-1111-4111-8111-111111111111', nome: 'Conta principal', tipo: 'Corrente', saldo_atual: 500 },
      { id: '22222222-2222-4222-8222-222222222222', nome: 'Reserva', tipo: 'Poupanca', saldo_atual: 100 },
    ]);
    mocks.categorias.mockResolvedValue([]);
    mocks.criar.mockResolvedValue({ id: 'transaction-id' });
    mocks.editar.mockResolvedValue({ id: 'transfer-out' });
  });

  it('mantém as ações de salvar ancoradas ao diálogo em telas pequenas', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Nova Transação' }));
    const dialog = screen.getByRole('dialog', { name: 'Registrar Transação' });
    const saveButton = screen.getByRole('button', { name: 'Salvar Transação' });
    expect(dialog).toContainElement(saveButton);
    expect(saveButton.closest('div')?.className ?? '').not.toMatch(/\bfixed\b/);
  });

  it('registra uma despesa com os campos essenciais', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Nova Transação' }));
    await waitFor(() => expect(mocks.contas).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Mercado' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '12550' } });
    await chooseSelect(1, /Conta principal/);
    expect(screen.getByText('Resumo do lançamento')).toBeInTheDocument();
    expect(screen.getByText(/374,50/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Transação' }));

    await waitFor(() => expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({
      descricao: 'Mercado', valor: 125.5, tipo: 'Despesa',
      conta_id: '11111111-1111-4111-8111-111111111111',
    })));
  }, 10_000);

  it('associa erros de validação aos campos inválidos', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Nova Transação' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Transação' }));

    const description = screen.getByLabelText('Descrição');
    await waitFor(() => expect(description).toHaveAttribute('aria-invalid', 'true'));
    expect(description).toHaveAccessibleDescription();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(mocks.criar).not.toHaveBeenCalled();
  });

  it('mostra o saldo projetado para uma receita', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Nova Transação' }));
    await waitFor(() => expect(mocks.contas).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: /Receita.*Dinheiro que entrou/i }));
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '25000' } });
    await chooseSelect(1, /Conta principal/);

    expect(screen.getByText('Resumo do lançamento')).toBeInTheDocument();
    expect(screen.getByText(/750,00/)).toBeInTheDocument();
  });

  it('registra uma despesa parcelada dividindo o valor entre os meses', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Nova Transação' }));
    await waitFor(() => expect(mocks.contas).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Curso anual' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '120000' } });
    await chooseSelect(1, /Conta principal/);
    await userEvent.click(screen.getByLabelText('Frequência do lançamento'));
    await userEvent.click(await screen.findByRole('option', { name: /Parcelado/ }));
    fireEvent.change(screen.getByLabelText('Número de Parcelas'), { target: { value: '12' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Transação' }));

    await waitFor(() => expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'Despesa', valor: 1200, total_parcelas: 12, recorrente: false,
    })));
  });

  it('registra uma receita recorrente repetindo o valor integral por mês', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Nova Transação' }));
    await waitFor(() => expect(mocks.contas).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: /Receita.*Dinheiro que entrou/i }));
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Contrato mensal' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '250000' } });
    await chooseSelect(1, /Conta principal/);
    await userEvent.click(screen.getByLabelText('Frequência do lançamento'));
    await userEvent.click(await screen.findByRole('option', { name: /Recorrente/ }));
    fireEvent.change(screen.getByLabelText('Duração da Recorrência (meses)'), { target: { value: '6' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Transação' }));

    await waitFor(() => expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'Receita', valor: 2500, total_parcelas: 6, recorrente: true,
    })));
  });

  it('orienta e registra uma transferência com origem e destino distintos', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Nova Transação' }));
    await waitFor(() => expect(mocks.contas).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: /Transferência.*Entre suas contas/i }));
    expect(screen.getByText('Conta de Origem')).toBeInTheDocument();
    expect(screen.getByText('Conta de Destino')).toBeInTheDocument();
    expect(screen.queryByText('Subcategoria (Opcional)')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Frequência do lançamento')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Aplicação mensal' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '20000' } });
    await chooseSelect(1, /Conta principal/);
    const destination = screen.getAllByRole('combobox')[2];
    await userEvent.click(destination);
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByRole('option', { name: /Conta principal/ })).not.toBeInTheDocument();
    await userEvent.click(within(listbox).getByRole('option', { name: /Reserva/ }));
    expect(screen.getByText((_, element) => (
      element?.tagName === 'P' && element.textContent?.includes('200,00') === true
      && element.textContent.includes('sairão de Conta principal')
    ))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Transação' }));

    await waitFor(() => expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'Transferencia', valor: 200,
      conta_id: '11111111-1111-4111-8111-111111111111',
      conta_destino_id: '22222222-2222-4222-8222-222222222222',
    })));
  });

  it('registra uma transferência recorrente entre as mesmas contas', async () => {
    renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Nova Transação' }));
    await waitFor(() => expect(mocks.contas).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: /Transferência.*Entre suas contas/i }));
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Aporte mensal' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '30000' } });
    await chooseSelect(1, /Conta principal/);
    await userEvent.click(screen.getAllByRole('combobox')[2]);
    await userEvent.click(await screen.findByRole('option', { name: /Reserva/ }));
    await userEvent.click(screen.getByLabelText('Frequência do lançamento'));
    await userEvent.click(await screen.findByRole('option', { name: /Recorrente/ }));
    expect(screen.queryByRole('option', { name: /Parcelado/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Duração da Recorrência (meses)'), { target: { value: '6' } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Transação' }));

    await waitFor(() => expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'Transferencia', valor: 300, total_parcelas: 6, recorrente: true,
      conta_id: '11111111-1111-4111-8111-111111111111',
      conta_destino_id: '22222222-2222-4222-8222-222222222222',
    })));
  });

  it('abre a transferência agrupada para edição com as duas contas', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <NovaTransacaoModal editItem={{
          id: 'transfer-out', conta_id: '11111111-1111-4111-8111-111111111111',
          descricao: '[Saída] Aplicação mensal', valor: 200, tipo: 'Transferencia',
          data_transacao: '2026-08-07T12:00:00.000Z', status: 'Pago',
          transferencia_direcao: 'Saida',
          transferencia_grupo: { transacoes: [
            { id: 'transfer-out', conta_id: '11111111-1111-4111-8111-111111111111', transferencia_direcao: 'Saida', conta: { nome: 'Conta principal' } },
            { id: 'transfer-in', conta_id: '22222222-2222-4222-8222-222222222222', transferencia_direcao: 'Entrada', conta: { nome: 'Reserva' } },
          ] },
        }} />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: /Editar.*Aplicação mensal/ }));
    await waitFor(() => expect(mocks.contas).toHaveBeenCalled());
    expect(screen.getByText('Tipo:')).toHaveTextContent('Transferência entre contas');
    expect(screen.getAllByRole('combobox')[1]).toHaveTextContent('Conta principal');
    expect(screen.getAllByRole('combobox')[2]).toHaveTextContent('Reserva');
    expect(screen.getByLabelText('Descrição')).toHaveValue('Aplicação mensal');
  });
});
