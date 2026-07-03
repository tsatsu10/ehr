/**
 * V1.1-ANC smoke — ancillary visit types + M7-F18 report (§21.1i).
 *
 * @group e2e
 * @group new-clinic-v11-anc
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login: loginAsAdmin, login } = require('../helpers/auth');

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';
const RECEPTION_USER = process.env.TEST_USERNAME_RECEPTION || 'reception_user';
const RECEPTION_PASS = process.env.TEST_PASSWORD_RECEPTION || 'test_pass';

const SCRIPTS_DIR = path.join(
  __dirname,
  '../../../../interface/modules/custom_modules/oe-module-new-clinic/scripts',
);

function runPhpScript(scriptName) {
  const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
  const script = path.join(SCRIPTS_DIR, scriptName);
  execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
}

async function fetchVisitTypes(page) {
  const island = page.locator('[data-island="front-desk"]');
  await expect(island).toBeVisible({ timeout: 30000 });
  const rawProps = await island.getAttribute('data-props');
  const props = JSON.parse(rawProps ?? '{}');

  return page.evaluate(
    async ({ ajaxUrl, csrfToken, facilityId }) => {
      const url = new URL(ajaxUrl, window.location.origin);
      url.searchParams.set('action', 'visit.types');
      if (facilityId > 0) {
        url.searchParams.set('facility_id', String(facilityId));
      }
      url.searchParams.set('csrf_token_form', csrfToken);
      const response = await fetch(url.toString());
      const payload = await response.json();
      return payload.data?.visit_types ?? payload.visit_types ?? [];
    },
    {
      ajaxUrl: props.ajaxUrl,
      csrfToken: props.csrfToken,
      facilityId: Number(props.facilityId ?? 0),
    },
  );
}

test.describe('V1.1-ANC smoke', () => {
  test.beforeAll(() => {
    runPhpScript('pilot-enable-v11-anc.php');
    const seedScript = path.join(
      __dirname,
      '../../../../interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php',
    );
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${seedScript}"`, { stdio: 'inherit' });
  });

  test('visit.types exposes lab-direct and pharmacy walk-in profiles', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, RECEPTION_USER, RECEPTION_PASS);
    await page.goto(`${MODULE_BASE}/front-desk.php`);

    const types = await fetchVisitTypes(page);
    const profiles = types.map((row) => row.service_profile);
    expect(profiles).toContain('lab_direct');
    expect(profiles).toContain('pharmacy_walkin');

    const labType = types.find((row) => row.service_profile === 'lab_direct');
    expect(labType?.service_profile_hint).toMatch(/Lab-only/i);
    expect(labType?.allows_referral_upload).toBe(true);
  });

  test('daily reports ancillary tab loads M7-F18 KPIs', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    await page.goto(`${MODULE_BASE}/reports.php`);
    const ancillaryResp = page.waitForResponse(
      (resp) => resp.url().includes('reports.ancillary') && resp.ok(),
      { timeout: 45000 },
    );
    await page.getByRole('tab', { name: /^Ancillary$/i }).click();
    const response = await ancillaryResp;
    const body = await response.json();
    expect(body.data?.enabled).toBe(true);

    await expect(page.getByRole('heading', { name: /Visits by service profile/i })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText('Lab-direct', { exact: true })).toBeVisible();
    await expect(page.getByText('Pharmacy walk-in', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Pharmacy walk-in outcomes/i })).toBeVisible();
  });
});
