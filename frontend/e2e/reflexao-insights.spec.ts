import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pillar = { orcado: 1000, realizado: 800, saldo: 200, categorias: {} };
const report = {
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
  pilares: { Sobrevivencia: pillar, Lazer: pillar, Cultura: pillar, Extras: pillar },
};

test('apresenta os novos indicadores da Reflexão sem overflow', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'e2e-user', nome: 'Usuário Reflexão', email: 'reflexao@e2e.local' }) }));
  await page.route('**/api/relatorios/kakebo-reflexao**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(report) }));
  await page.route('**/api/contas**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[{}]' }));
  await page.route('**/api/orcamentos**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[{}]' }));
  await page.route('**/api/transacoes**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"transacoes":[{}],"total":1}' }));

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Reflexão Kakebo' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Indicadores financeiros do mês' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Insights do mês' })).toBeVisible();
  await expect(page.getByText('Despesas em queda')).toBeVisible();
  await expect(page.getByText('Evolução financeira')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Projeção e saúde financeira' })).toBeVisible();
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);
  const accessibility = await new AxeBuilder({ page }).analyze();
  const blockingViolations = accessibility.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
  expect(blockingViolations, 'A Reflexão não deve ter violações críticas ou graves de acessibilidade').toEqual([]);
});
