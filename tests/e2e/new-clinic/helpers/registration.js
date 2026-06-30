/**
 * Front desk registration + auto-start visit helpers for golden path E2E specs.
 */

const { expect } = require('@playwright/test');

async function selectRadixOption(page, triggerSelector, optionLabel) {
  await page.locator(triggerSelector).click();
  await page.getByRole('option', { name: optionLabel, exact: true }).click();
}

/**
 * Register a new patient via the full desk form and wait for Save & Start visit
 * to complete (patients.create → preview → visit.start → success banner).
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ fname: string, lname: string, phone: string, nationalId: string }} patient
 */
async function registerAndStartVisit(page, patient) {
  await page.locator('#nc-add-patient').click();
  await page.locator('#nc-reg-fname').waitFor({ state: 'visible' });

  await page.fill('#nc-reg-fname', patient.fname);
  await page.fill('#nc-reg-lname', patient.lname);
  await page.fill('#nc-reg-dob-s1', '1990-01-01');
  await selectRadixOption(page, '#nc-reg-sex', 'Male');
  await page.fill('#nc-reg-phone', patient.phone);

  const dupWait = page.waitForResponse(
    (resp) => resp.url().includes('dup_check') && resp.ok(),
    { timeout: 15000 },
  );
  await page.fill('#nc-reg-national-id', patient.nationalId);
  await page.locator('#nc-reg-national-id').blur();
  await dupWait.catch(() => {});
  await page.waitForTimeout(500);

  const dupConfirm = page.locator('#nc-dup-confirm');
  const regError = page.locator('#nc-reg-error');
  const startSuccess = page.locator('#nc-start-visit-success');
  const startError = page.locator('#nc-start-visit-error');

  let saved = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await dupConfirm.isVisible().catch(() => false)) {
      await dupConfirm.check();
      await expect(dupConfirm).toBeChecked();
      await page.waitForTimeout(200);
    }

    const saveResponse = page.waitForResponse(
      (resp) => {
        const url = resp.url();
        return (url.includes('patients.create') || url.includes('patients.update'))
          && resp.request().method() === 'POST'
          && resp.ok();
      },
      { timeout: 45000 },
    );

    await page.locator('#nc-reg-save-start').click();

    try {
      await saveResponse;
      saved = true;
      break;
    } catch {
      if (await regError.isVisible().catch(() => false)) {
        const message = (await regError.textContent()) ?? '';
        if (/different patient/i.test(message) && attempt < 3) {
          await page.waitForTimeout(500);
          continue;
        }
        throw new Error(`Registration failed: ${message}`);
      }
      if (attempt < 3) {
        await page.waitForTimeout(1000);
        continue;
      }
      throw new Error('Registration save did not complete');
    }
  }

  if (!saved) {
    throw new Error('Registration save did not complete');
  }

  await page.waitForResponse(
    (resp) => resp.url().includes('visit.start') && resp.ok(),
    { timeout: 60000 },
  ).catch(() => {});

  await expect(startSuccess).toBeVisible({ timeout: 30000 });
  if (await startError.isVisible().catch(() => false)) {
    throw new Error(`Start visit failed: ${await startError.textContent()}`);
  }

  const successText = await startSuccess.textContent();
  const queueNumber = successText?.match(/#(\d+)/)?.[1];
  return { queueNumber };
}

module.exports = {
  registerAndStartVisit,
  selectRadixOption,
};
