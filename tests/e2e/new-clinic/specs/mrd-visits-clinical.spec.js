/**
 * MRD Visits + Clinical tab smoke — tests 41–42 (MRD §8.5 / §8.9, PRD §21.1k/l)
 *
 * @group e2e
 * @group new-clinic-mandatory
 */

const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login: loginAsAdmin } = require('../helpers/auth');

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';
const CHART_PID = Number(process.env.NC_MRD_CHART_PID || 4);

test.describe('MRD visits and clinical tabs', () => {
  test('visits API paginates past visits at 20 rows (test 41)', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(`${MODULE_BASE}/patient-chart.php?pid=${CHART_PID}&tab=visits`);
    await expect(page.locator('#nc-patient-chart')).toBeVisible({ timeout: 20000 });

    const ajaxUrl = await page.evaluate(() => {
      const root = document.querySelector('[data-island="patient-chart"]');
      if (!root) {
        return '';
      }
      const props = JSON.parse(root.getAttribute('data-props') || '{}');
      return props.ajaxUrl || '';
    });
    expect(ajaxUrl).toBeTruthy();

    const visitsResp = await page.request.get(
      `${ajaxUrl}?action=patients.chart.visits&pid=${CHART_PID}&offset=0&limit=20`,
    );
    expect(visitsResp.ok()).toBeTruthy();
    const visitsJson = await visitsResp.json();
    expect(visitsJson.success).toBe(true);
    expect(Array.isArray(visitsJson.data.today_visits)).toBe(true);
    expect(Array.isArray(visitsJson.data.past_visits)).toBe(true);
    expect(visitsJson.data.past_visits.length).toBeLessThanOrEqual(20);
    expect(typeof visitsJson.data.past_has_more).toBe('boolean');
  });

  test('clinical tab exposes MRD anchor sections (test 42)', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(`${MODULE_BASE}/patient-chart.php?pid=${CHART_PID}&tab=clinical`);
    await expect(page.locator('#nc-patient-chart')).toBeVisible({ timeout: 20000 });

    await expect(page.locator('#clinical-background')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#clinical-allergies')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#clinical-problems')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#clinical-meds')).toBeVisible({ timeout: 30000 });
  });

  test('visits tab renders View documentation when encounter exists (test 42)', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(`${MODULE_BASE}/patient-chart.php?pid=${CHART_PID}&tab=visits`);
    await expect(page.locator('#nc-patient-chart')).toBeVisible({ timeout: 20000 });

    const ajaxUrl = await page.evaluate(() => {
      const root = document.querySelector('[data-island="patient-chart"]');
      if (!root) {
        return '';
      }
      const props = JSON.parse(root.getAttribute('data-props') || '{}');
      return props.ajaxUrl || '';
    });

    const visitsResp = await page.request.get(
      `${ajaxUrl}?action=patients.chart.visits&pid=${CHART_PID}&offset=0`,
    );
    expect(visitsResp.ok()).toBeTruthy();
    const visitsJson = await visitsResp.json();
    const allVisits = [
      ...(visitsJson.data?.today_visits ?? []),
      ...(visitsJson.data?.past_visits ?? []),
    ];
    const withDoc = allVisits.find((row) => row.documentation_url);
    test.skip(!withDoc, 'No visit with documentation_url in fixture data');

    await expect(page.getByRole('link', { name: 'View documentation' }).first()).toBeVisible({
      timeout: 30000,
    });
  });
});
