/**
 * Shared Playwright helpers for New Clinic E2E specs.
 */

const BASE_URL = (process.env.TEST_BASE_URL || 'http://localhost/openemr').replace(/\/$/, '');

/**
 * @param {import('@playwright/test').Page} page
 */
async function login(page, username, password) {
  await page.goto(`${BASE_URL}/interface/login/login.php?site=default`);
  await page.locator('#authUser').waitFor({ state: 'visible', timeout: 20000 });
  await page.fill('#authUser', username);
  await page.fill('#clearPass', password);
  await page.locator('#login-button, #login_button').first().click();
  await page.waitForFunction(
    () => !window.location.href.includes('login.php') && !window.location.href.includes('login_screen'),
    { timeout: 30000 },
  ).catch(async () => {
    const failure = await page.locator('.login-failure, .alert-danger').first().textContent().catch(() => '');
    throw new Error(`Login failed for ${username}: ${failure.trim() || page.url()}`);
  });
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function logout(page) {
  await page.goto(`${BASE_URL}/interface/logout.php`);
  await page.waitForLoadState('domcontentloaded');
}

module.exports = {
  BASE_URL,
  MODULE_BASE: `${BASE_URL}/interface/modules/custom_modules/oe-module-new-clinic/public`,
  login,
  logout,
};
