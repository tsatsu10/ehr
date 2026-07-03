/**
 * Cashier desk helpers for golden path E2E specs.
 */

const { expect } = require('@playwright/test');

/**
 * Close a visit at cashier — zero-charge close or take payment.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ lname: string }} patient
 * @param {string} zeroReason Reason text when closing without charge
 */
async function completeCashierVisit(page, patient, zeroReason) {
  await expect(page.locator('#nc-cashier-active-pane')).toContainText(patient.lname, { timeout: 15000 });

  const closeZeroBtn = page.locator('#nc-cashier-close-zero-btn');
  await expect(
    closeZeroBtn.or(page.locator('#nc-cashier-pay-btn')).or(page.locator('#nc-cash-received')),
  ).toBeVisible({ timeout: 15000 });

  if (await closeZeroBtn.isVisible().catch(() => false)) {
    await closeZeroBtn.click();
    await expect(page.getByRole('heading', { name: 'Close without charge' })).toBeVisible();
    await page.fill('#nc-cashier-close-zero-reason', zeroReason);
    await page.locator('.modal.show').getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('heading', { name: 'Close without charge' })).toBeHidden({
      timeout: 15000,
    });
    await expect(page.locator(`.nc-queue-card:has-text("${patient.lname}")`)).toHaveCount(0, {
      timeout: 15000,
    });
    return;
  }

  const totalDue = await page.locator('#nc-cashier-active-pane input[readonly]').first().inputValue();
  const amount = totalDue && parseFloat(totalDue.replace(/[^\d.]/g, '')) > 0
    ? totalDue.replace(/[^\d.]/g, '')
    : '50.00';

  await page.fill('#nc-cash-received', amount);
  await page.locator('#nc-cashier-pay-btn').click();

  if (await page.locator('#nc-cashier-pay-confirm-modal').isVisible().catch(() => false)) {
    await page.locator('#nc-cashier-pay-confirm-btn').click();
  }

  await expect(page.locator('#nc-cashier-receipt-modal, .alert-success')).toBeVisible({ timeout: 15000 });
}

module.exports = {
  completeCashierVisit,
};
