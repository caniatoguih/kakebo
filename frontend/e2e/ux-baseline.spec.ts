import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import path from 'node:path';

async function auditAccessibility(page: Page, testInfo: TestInfo, name: string) {
  const accessibility = await new AxeBuilder({ page }).analyze();
  console.log(`[a11y:${testInfo.project.name}:${name}] ${accessibility.violations.length} violações: ${accessibility.violations.map((item) => `${item.id}:${item.impact}`).join(', ') || 'nenhuma'}`);
  for (const violation of accessibility.violations) {
    console.log(`[a11y:${testInfo.project.name}:${name}:${violation.id}] ${violation.nodes.map((node) => `${node.target.join(' ')} — ${node.failureSummary ?? violation.help}`).join(' | ')}`);
  }
  await testInfo.attach(`acessibilidade-${name}.json`, {
    body: JSON.stringify(accessibility.violations, null, 2),
    contentType: 'application/json',
  });
  const blockingViolations = accessibility.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(blockingViolations, `${name} não deve ter violações críticas ou graves de acessibilidade`).toEqual([]);
}

test('registra usuário e valida a navegação principal', async ({ page, isMobile }, testInfo) => {
  test.setTimeout(90_000);
  const unique = `${testInfo.project.name}-${Date.now()}@e2e.kakebo.local`;
  const consoleProblems: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    const isFrameworkProblem = /react|radix|controlled|uncontrolled|unique.+key|aria-describedby/i.test(text);
    if (message.type() === 'warning' || (message.type() === 'error' && isFrameworkProblem)) {
      consoleProblems.push(`[${message.type()}] ${text}`);
    }
  });

  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Usuário E2E');
  await page.getByLabel('E-mail').fill(unique);
  await page.getByLabel('Senha').fill('E2E!2026');
  await page.getByRole('button', { name: 'Criar Conta' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('E-mail').fill(unique);
  await page.getByLabel('Senha').fill('E2E!2026');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Reflexão Kakebo' })).toBeVisible();

  if (isMobile) {
    const mobileNavigation = page.getByRole('navigation', { name: 'Navegação principal mobile' });
    await expect(mobileNavigation).toBeVisible();
    await expect(mobileNavigation.getByRole('link')).toHaveCount(4);
    await expect(mobileNavigation.getByRole('link', { name: 'Reflexão' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('Você está em')).toBeVisible();

    await mobileNavigation.getByRole('link', { name: 'Planejar' }).click();
    await expect(page).toHaveURL(/\/planejamento$/);
    await expect(page.getByText('Você está em')).toBeVisible();
    await expect(page.locator('main > header').getByText('Planejamento', { exact: true })).toBeVisible();
    await expect(mobileNavigation.getByRole('link', { name: 'Planejar' })).toHaveAttribute('aria-current', 'page');

    await mobileNavigation.getByRole('link', { name: 'Fluxo' }).click();
    await expect(page).toHaveURL(/\/transacoes$/);
    await expect(page.locator('main > header').getByText('Fluxo de Caixa', { exact: true })).toBeVisible();
  } else {
    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: 'Reflexão' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Fluxo de Caixa' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Planejamento' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Visão Contábil' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Contas e Cartões' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Categorias' })).toBeVisible();
  }

  await page.goto('/dashboard');
  const planningLink = page.getByRole('link', { name: 'Ver planejamento' });
  await expect(planningLink).toBeVisible({ timeout: 15_000 });
  const expectedMonth = new Date().toISOString().slice(0, 7);
  await planningLink.click();
  await expect(page).toHaveURL(new RegExp(`/planejamento\\?mes=${expectedMonth}$`));
  await expect(page.getByRole('heading', { name: 'Planejamento', exact: true })).toBeVisible();

  await page.goto('/dashboard');
  await page.screenshot({
    path: path.resolve('../docs/ux-baseline', `${testInfo.project.name}-dashboard.png`),
    fullPage: true,
  });

  await auditAccessibility(page, testInfo, 'dashboard');

  await page.goto('/transacoes');
  await expect(page.getByRole('heading', { name: 'Fluxo de Caixa' })).toBeVisible();
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);
  const newTransaction = page.locator('button:visible').filter({ hasText: 'Nova Transação' }).first();
  await newTransaction.focus();
  await page.keyboard.press('Enter');
  const transactionDialog = page.getByRole('dialog', { name: 'Registrar Transação' });
  await expect(transactionDialog).toBeVisible();
  await expect(transactionDialog.locator(':focus')).toHaveCount(1);
  await auditAccessibility(page, testInfo, 'modal-nova-transacao');
  await page.keyboard.press('Escape');
  await expect(newTransaction).toBeFocused();
  const filterToggle = page.getByRole('button', { name: /Filtros/ });
  await filterToggle.click();
  await expect(filterToggle).toHaveAttribute('aria-expanded', 'true');
  await auditAccessibility(page, testInfo, 'filtros-fluxo-de-caixa');

  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  await page.getByRole('button', { name: 'Importar CSV' }).click();
  const csvDialog = page.getByRole('dialog', { name: 'Importar Transações via CSV' });
  await expect(csvDialog).toBeVisible();
  await auditAccessibility(page, testInfo, 'modal-importar-csv');
  await page.keyboard.press('Escape');
  await page.screenshot({
    path: path.resolve('../docs/ux-baseline', `${testInfo.project.name}-fluxo-de-caixa.png`),
    fullPage: true,
  });
  await auditAccessibility(page, testInfo, 'fluxo-de-caixa');

  const remainingPages = [
    { path: '/planejamento', heading: 'Planejamento', name: 'planejamento' },
    { path: '/contas', heading: 'Contas & Cartões', name: 'contas' },
    { path: '/categorias', heading: 'Gerenciar Categorias', name: 'categorias' },
    { path: '/fluxo-contabil', heading: 'Visão Contábil (DFC)', name: 'visao-contabil' },
  ];
  for (const destination of remainingPages) {
    await page.goto(destination.path);
    await expect(page.getByRole('heading', { name: destination.heading, exact: true })).toBeVisible();
    await auditAccessibility(page, testInfo, destination.name);
  }

  await page.goto('/planejamento');
  const newBudget = page.locator('button:visible').filter({ hasText: 'Novo Orçamento' }).first();
  await newBudget.focus();
  await page.keyboard.press('Enter');
  const budgetDialog = page.getByRole('dialog', { name: 'Novo Orçamento' });
  await expect(budgetDialog).toBeVisible();
  await auditAccessibility(page, testInfo, 'modal-novo-orcamento');
  await page.keyboard.press('Escape');
  await expect(newBudget).toBeFocused();

  await page.goto('/contas');
  const newAccount = page.locator('button:visible').filter({ hasText: 'Nova Conta' }).first();
  await newAccount.focus();
  await page.keyboard.press('Enter');
  const accountDialog = page.getByRole('dialog', { name: 'Adicionar Conta / Cartão' });
  await expect(accountDialog).toBeVisible();
  await expect(accountDialog.locator(':focus')).toHaveCount(1);
  await auditAccessibility(page, testInfo, 'modal-nova-conta');
  await page.keyboard.press('Escape');
  await expect(newAccount).toBeFocused();
  expect(consoleProblems, 'Os fluxos cobertos não devem emitir avisos de React, Radix ou componentes controlados').toEqual([]);
});
