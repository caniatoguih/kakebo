import { expect, test } from '@playwright/test';

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

test('adapta o fluxo contábil à largura disponível', async ({ page, isMobile }, testInfo) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'e2e-user', nome: `Usuário ${testInfo.project.name}`, email: 'fluxo@e2e.local' }),
  }));
  await page.route('**/api/contas**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  await page.route('**/api/relatorios/fluxo-contabil**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(report),
  }));
  await page.goto('/fluxo-contabil');
  await expect(page.getByRole('heading', { name: 'Visão Contábil (DFC)' })).toBeVisible();

  const mobileSummary = page.getByRole('region', { name: 'Resumo mensal do fluxo contábil' });
  const desktopTable = page.locator('#dfc-table-container');

  if (isMobile) {
    await expect(mobileSummary).toBeVisible();
    await expect(desktopTable).toBeHidden();
    await expect(page.getByLabel('Mês', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Modo Período')).toBeHidden();
    await expect(mobileSummary.getByRole('heading', { name: 'Ago 2026' })).toBeVisible();
    const housing = mobileSummary.getByRole('button', { name: /Moradia/ });
    await housing.click();
    await expect(housing).toHaveAttribute('aria-expanded', 'true');
    await expect(mobileSummary.getByText('Aluguel')).toBeVisible();
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);
  } else {
    await expect(mobileSummary).toBeHidden();
    await expect(desktopTable).toBeVisible();
    await expect(page.getByLabel('Modo Período')).toBeVisible();
    await expect(page.getByLabel('Mês', { exact: true })).toBeHidden();
    await expect(desktopTable.getByRole('columnheader', { name: 'Descrição Contábil' })).toBeVisible();

    const kpiCards = page.locator('.kpi-section > *');
    const cardBoxes = await kpiCards.evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().top));
    expect(new Set(cardBoxes.map((top) => Math.round(top))).size).toBe(1);
  }
});
