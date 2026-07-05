/**
 * MRD activity feed smoke — tests 39–40 (MRD §8.4, PRD §21.1k)
 *
 * @group e2e
 * @group new-clinic-mandatory
 */

const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login: loginAsAdmin } = require('../helpers/auth');

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';
const CHART_PID = Number(process.env.NC_MRD_CHART_PID || 4);

test.describe('MRD activity feed', () => {
  test('patient chart loads and activity feed API returns MRD contract fields', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);
    await page.goto(`${MODULE_BASE}/patient-chart.php?pid=${CHART_PID}&tab=overview`);
    await expect(page.locator('#nc-patient-chart')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#nc-chart-activity-feed-list, text=No recent visit activity')).toBeVisible({
      timeout: 20000,
    });

    const ajaxUrl = await page.evaluate(() => {
      const root = document.querySelector('[data-island="patient-chart"]');
      if (!root) {
        return '';
      }
      const props = JSON.parse(root.getAttribute('data-props') || '{}');
      return props.ajaxUrl || '';
    });
    expect(ajaxUrl).toBeTruthy();

    const feedResp = await page.request.get(
      `${ajaxUrl}?action=patients.chart.activity_feed&pid=${CHART_PID}&offset=0&limit=25`,
    );
    expect(feedResp.ok()).toBeTruthy();
    const feedJson = await feedResp.json();
    expect(feedJson.success).toBe(true);
    expect(feedJson.data).toMatchObject({
      lookback_days: expect.any(Number),
      max_lookback_days: 365,
      has_more: expect.any(Boolean),
      can_extend_lookback: expect.any(Boolean),
    });
    expect(Array.isArray(feedJson.data.items)).toBe(true);
  });
});
