import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import type { PainelReflexaoData } from '@/services/relatoriosService';

const mocks = vi.hoisted(() => ({ reflection: vi.fn(), accounts: vi.fn(), budgets: vi.fn(), transactions: vi.fn() }));
vi.mock('@/services/relatoriosService', () => ({ relatoriosService: { getPainelReflexao: mocks.reflection } }));
vi.mock('@/services/contasService', () => ({ contasService: { listar: mocks.accounts } }));
vi.mock('@/services/orcamentosService', () => ({ orcamentosService: { listar: mocks.budgets } }));
vi.mock('@/services/transacoesService', () => ({ transacoesService: { listar: mocks.transactions } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ usuario: { id: 'user-id' } }) }));

const pillars = Object.fromEntries(['Sobrevivencia', 'Lazer', 'Cultura', 'Extras'].map((name) => [name, { orcado: 1000, realizado: 800, saldo: 200, categorias: {} }]));
const data: PainelReflexaoData = {
  mes: 8, ano: 2026,
  resumo: {
    total_orcado: 4000, total_realizado: 3200, saldo_geral: 800,
    receitas_realizadas: 6000, despesas_realizadas: 3200, receitas_previstas: 0, despesas_previstas: 300,
    resultado_real: 2800, resultado_previsto: 2500, taxa_poupanca: 46.7,
    aderencia_orcamento: 80, folga_orcamento: 800, despesas_sem_categoria: 0,
  },
  comparacao_mes_anterior: { receitas_percentual: 5, despesas_percentual: -10, resultado_percentual: 20 },
  historico: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].map((competencia, index) => ({ competencia, receitas: 5000 + index * 200, despesas: 3000 + index * 40, resultado: 2000 + index * 160, orcado: 4000 })),
  desvios: [{ categoria: 'Lazer', pilar: 'Lazer', orcado: 500, realizado: 700, diferenca: 200, percentual: 40 }],
  projecao: { despesas_projetadas: 3500, resultado_projetado: 2500, compromissos_pendentes: 300, percentual_orcamento_projetado: 87.5, dias_decorridos: 11, dias_no_mes: 31 },
  saude: { despesas_essenciais: 1800, percentual_renda_essenciais: 30, compromissos_recorrentes: 400, percentual_renda_recorrencias: 6.7, faturas_abertas: 900, limite_cartoes: 8000, utilizacao_cartoes: 11.25, reserva: 12000, meses_cobertura: 6.7 },
  insights: [{ tipo: 'positivo', titulo: 'Despesas em queda', descricao: 'Você gastou 10% menos.' }],
  pilares: pillars,
};

describe('Dashboard de reflexão', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reflection.mockResolvedValue(data);
    mocks.accounts.mockResolvedValue([{}]);
    mocks.budgets.mockResolvedValue([{}]);
    mocks.transactions.mockResolvedValue({ transacoes: [{}], total: 1 });
  });

  it('apresenta indicadores, insights, tendência, projeção e saúde financeira', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><Dashboard /></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByRole('region', { name: 'Indicadores financeiros do mês' })).toBeInTheDocument();
    expect(screen.getByText(/6\.000,00/)).toBeInTheDocument();
    expect(screen.getByText('46,7%')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Insights do mês' })).toBeInTheDocument();
    expect(screen.getByText('Despesas em queda')).toBeInTheDocument();
    expect(screen.getByLabelText('Evolução de receitas e despesas realizadas nos últimos seis meses')).toBeInTheDocument();
    expect(screen.getByLabelText('Categorias com os maiores desvios em relação ao orçamento')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Projeção e saúde financeira' })).toBeInTheDocument();
    expect(screen.getByText('6,7 meses')).toBeInTheDocument();
  });
});
