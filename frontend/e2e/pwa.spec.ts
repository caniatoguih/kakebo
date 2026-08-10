import { expect, test } from '@playwright/test';

test.describe('PWA de produção', () => {
  test.skip(process.env.E2E_PWA !== 'true', 'Executado somente contra o build de produção.');

  test('instala o service worker e mantém a aplicação disponível offline', async ({ context, page }) => {
    await page.goto('/login');
    await expect(page.getByText('Kakebo', { exact: true })).toBeVisible();

    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await context.setOffline(true);
    await expect(page.getByRole('status')).toContainText('Você está offline');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Kakebo', { exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Você está offline');

    await context.setOffline(false);
    await page.getByRole('button', { name: 'Verificar conexão' }).click();
    await expect(page.getByText(/Você está offline/)).not.toBeVisible();
  });
});
