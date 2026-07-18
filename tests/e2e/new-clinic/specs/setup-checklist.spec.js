/**
 * Admin Hub — M15-F11 setup checklist golden path.
 *
 * Walks the checklist end to end and restores every state it touches:
 * deep link onto the System tab, tick → score moves → Undo → score back,
 * conditional Mark-setup-complete → residuals + Reopen → reopen, and the
 * staff row's provision affordance (asserted, never executed — creating
 * users is not reversible).
 *
 * @group e2e
 */

const { execFileSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login: loginAsAdmin } = require('../helpers/auth');

const ADMIN_USER = process.env.TEST_USERNAME_ADMIN || 'Adminstrator';
const ADMIN_PASS = process.env.TEST_PASSWORD_ADMIN || 'passpass1';

const PHP_BIN = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
const MODULE_ROOT = path.join(__dirname, '../../../../interface/modules/custom_modules/oe-module-new-clinic');

function runPhpScript(relativePath) {
  // execFileSync with an argument array: no shell, no injection surface.
  execFileSync(PHP_BIN, [path.join(MODULE_ROOT, relativePath)], { stdio: 'inherit' });
}

async function setupChipPercent(page) {
  const chip = page.locator('.nc-admin-metric-chip', { hasText: 'Setup' });
  const text = await chip.textContent();
  const match = /(\d+)%/.exec(text ?? '');
  return match ? Number(match[1]) : null;
}

test.describe('Admin M15 setup checklist golden path', () => {
  test.beforeAll(() => {
    runPhpScript('scripts/pilot-enable-v11-admin.php');
  });

  test('deep link, tick/undo round-trip, complete/reopen, provision affordance', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsAdmin(page, ADMIN_USER, ADMIN_PASS);

    // Deep link straight onto the System tab must survive the settings load
    // (regression guard: the gated-tab kick used to bounce this to Queue &
    // roles before the payload arrived).
    await page.goto(`${MODULE_BASE}/admin.php?tab=system`);
    const card = page.locator('#nc-admin-setup-checklist');
    await expect(card).toBeVisible({ timeout: 30000 });

    // If a previous run (or real use) marked setup complete, reopen so the
    // full checklist is on screen; restored at the end if we complete again.
    const reopenAtStart = card.getByRole('button', { name: 'Reopen setup' });
    const wasComplete = await reopenAtStart.isVisible().catch(() => false);
    if (wasComplete) {
      await reopenAtStart.click();
      await expect(card.getByText('Setup checklist')).toBeVisible({ timeout: 20000 });
    }

    const initialPercent = await setupChipPercent(page);
    expect(initialPercent).not.toBeNull();

    // g12 drill row: symmetric tick/undo round-trip that restores its state.
    const drillLabel = 'Wrong-patient safety drill done';
    const markBtn = card.getByRole('button', { name: `Mark "${drillLabel}" done` });
    const undoBtn = card.getByRole('button', { name: `Untick "${drillLabel}"` });
    const startedTicked = await undoBtn.isVisible().catch(() => false);

    if (startedTicked) {
      await undoBtn.click();
      await expect(markBtn).toBeVisible({ timeout: 20000 });
      await expect.poll(() => setupChipPercent(page)).toBe(initialPercent - 5);
      await markBtn.click();
      await expect(undoBtn).toBeVisible({ timeout: 20000 });
      await expect.poll(() => setupChipPercent(page)).toBe(initialPercent);
    } else {
      await markBtn.click();
      await expect(undoBtn).toBeVisible({ timeout: 20000 });
      await expect.poll(() => setupChipPercent(page)).toBe(initialPercent + 5);
      await undoBtn.click();
      await expect(markBtn).toBeVisible({ timeout: 20000 });
      await expect.poll(() => setupChipPercent(page)).toBe(initialPercent);
    }

    // Staff row: either truthfully done, or it must offer starter sign-ins.
    // (Never click it — user creation is not reversible.)
    const staffRow = card.locator('li', { hasText: 'Staff sign-ins created' });
    await expect(staffRow).toBeVisible();
    const staffDone = (await staffRow.textContent())?.includes('Done:');
    if (!staffDone) {
      await expect(staffRow.getByRole('button', { name: 'Create starter sign-ins' })).toBeVisible();
    }

    // Complete → residuals + Reopen → reopen, only when the threshold allows.
    const completeBtn = card.getByRole('button', { name: 'Mark setup complete' });
    if (await completeBtn.isVisible().catch(() => false)) {
      await completeBtn.click();
      await expect(card.getByText('Setup complete')).toBeVisible({ timeout: 20000 });
      const reopen = card.getByRole('button', { name: 'Reopen setup' });
      await expect(reopen).toBeVisible();
      if (!wasComplete) {
        await reopen.click();
        await expect(card.getByText('Setup checklist')).toBeVisible({ timeout: 20000 });
      }
    } else if (wasComplete) {
      // We reopened a previously-complete setup but cannot re-complete
      // (score below threshold) — flag loudly rather than silently altering state.
      throw new Error('Setup was complete but score is now below the threshold — checklist state changed under the test');
    }
  });
});
