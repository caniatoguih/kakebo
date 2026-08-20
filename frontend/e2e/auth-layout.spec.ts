import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('apresenta Login e Cadastro com o layout de autenticação responsivo', async ({ page, isMobile }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Não autenticado"}' }));
  await page.addInitScript(() => {
    if (localStorage.getItem('kakebo:theme') === null) {
      localStorage.setItem('kakebo:theme', 'light');
    }
  });

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Boas-vindas de volta' })).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
  const passwordInput = page.getByRole('textbox', { name: 'Senha', exact: true });
  await expect(passwordInput).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Exibir senha' }).click();
  await expect(passwordInput).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Sobre o Kakebo' })).toBeVisible({ visible: !isMobile });
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);

  await page.getByRole('button', { name: 'Usar tema escuro' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: 'Usar tema claro' })).toBeVisible();
  await expect(page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).resolves.toBe('rgb(0, 0, 0)');
  if (!isMobile) {
    await expect(page.getByRole('region', { name: 'Sobre o Kakebo' }).evaluate((element) => getComputedStyle(element).backgroundColor)).resolves.toBe('rgb(0, 0, 0)');
  }

  const loginAccessibility = await new AxeBuilder({ page }).analyze();
  const loginBlocking = loginAccessibility.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
  expect(loginBlocking, 'O Login não deve ter violações críticas ou graves de acessibilidade').toEqual([]);

  await page.getByRole('link', { name: 'Cadastre-se' }).click();
  await expect(page).toHaveURL(/\/cadastro$/);
  await expect(page.getByRole('heading', { name: 'Crie seu Kakebo' })).toBeVisible();
  await expect(page.getByLabel('Nome')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar Conta' })).toBeVisible();
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);
});
