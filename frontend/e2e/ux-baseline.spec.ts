import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import path from 'node:path';

test('registra usuário e valida a navegação principal', async ({ page, isMobile }, testInfo) => {
  const unique = `${testInfo.project.name}-${Date.now()}@e2e.kakebo.local`;

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

  const accessibility = await new AxeBuilder({ page }).analyze();
  console.log(`[a11y:${testInfo.project.name}] ${accessibility.violations.length} violações: ${accessibility.violations.map((item) => `${item.id}:${item.impact}`).join(', ') || 'nenhuma'}`);
  await testInfo.attach('acessibilidade-dashboard.json', {
    body: JSON.stringify(accessibility.violations, null, 2),
    contentType: 'application/json',
  });

  await page.goto('/transacoes');
  await expect(page.getByRole('heading', { name: 'Fluxo de Caixa' })).toBeVisible();
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);
  await page.screenshot({
    path: path.resolve('../docs/ux-baseline', `${testInfo.project.name}-fluxo-de-caixa.png`),
    fullPage: true,
  });
});
