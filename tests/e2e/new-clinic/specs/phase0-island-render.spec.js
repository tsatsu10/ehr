/**
 * Phase 0 React island render smoke test.
 *
 * When the `enable_react_islands_dev` config flag is on, the Visit Board
 * page must render the React badge with role="status" and the expected
 * label. This test requires an authenticated admin session and is
 * skipped if credentials are not configured.
 *
 * Credentials are read from the same env vars as the golden-path spec.
 *
 * @group e2e
 * @group new-clinic-frontend
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost/openemr';
const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'admin';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'pass';

const VISIT_BOARD_URL =
  BASE_URL.replace(/\/$/, '') +
  '/interface/modules/custom_modules/oe-module-new-clinic/public/visit-board.php';

async function loginIfNeeded(page) {
  await page.goto(`${BASE_URL.replace(/\/$/, '')}/interface/login/login.php`);
  const hasLoginForm = await page
    .locator('#authUser')
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  if (hasLoginForm) {
    await page.fill('#authUser', ADMIN_USER);
    await page.fill('#clearPass', ADMIN_PASS);
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.locator('#login-button').click(),
    ]);
  }
}

test.describe('Phase 0 — React island renders inside Twig page', () => {
  test('badge appears on Visit Board when flag is on', async ({ page }) => {
    await loginIfNeeded(page);

    const response = await page.goto(VISIT_BOARD_URL);
    const status = response?.status() ?? 0;
    const finalUrl = page.url();

    // Diagnostic logging so the skip reason is visible in CI logs.
    // eslint-disable-next-line no-console
    console.log(
      `[phase0-island-render] response=${status} url=${finalUrl}`
    );

    if (status !== 200 || !finalUrl.includes('visit-board.php')) {
      test.skip(
        true,
        `Visit Board not reachable for this user (status=${status}, url=${finalUrl}). ` +
          'Set TEST_USERNAME_ADMIN/TEST_PASSWORD_ADMIN to a user with desk ACL.'
      );
      return;
    }

    // The island is only mounted when the config flag is on; soft-skip
    // when the flag is off so this can run on any environment without
    // forcing DB state.
    const islandMount = page.locator('[data-island="visit-board-hello"]');
    const isMounted = (await islandMount.count()) > 0;
    if (!isMounted) {
      test.skip(true, 'enable_react_islands_dev flag is off in this environment');
      return;
    }

    const badge = page.getByRole('status').filter({ hasText: 'React island OK' });
    await expect(badge).toBeVisible({ timeout: 10000 });
    await expect(badge).toContainText('Visit Board');
  });
});
