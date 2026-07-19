/**
 * New Clinic E2E — deep golden path (pharm ops)
 *
 * Registration → triage → doctor formulary quick Rx → pharmacy dispense + label → cashier.
 *
 * Requires e2e-prep-golden-path.php (enable_pharm_ops, formulary seed, stock, labels).
 *
 * @group e2e
 * @group new-clinic-mandatory
 */

const { execSync } = require('child_process');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULE_BASE, login, logout } = require('../helpers/auth');
const { registerAndStartVisit } = require('../helpers/registration');
const { completeCashierVisit } = require('../helpers/cashier');

test.describe.configure({ timeout: 300_000 });

function generatePatientName() {
  const timestamp = Date.now();
  const suffix = String(timestamp).slice(-8);
  // Registration validates names as letters-only — map digits to letters.
  const letterSuffix = suffix.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]);
  return {
    fname: `Etoe${letterSuffix.slice(0, 4)}`,
    lname: `Rx${letterSuffix}`,
    fullName: `Etoe${letterSuffix.slice(0, 4)} Rx${letterSuffix}`,
    phone: `0245${suffix.slice(-6).padStart(6, '0')}`,
    nationalId: `GHRX${timestamp}`,
  };
}

async function waitForQueueCard(page, lname) {
  const card = page.locator(`[class*="queue-card"]:has-text("${lname}")`).first();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await card.isVisible().catch(() => false) && await card.isEnabled().catch(() => false)) {
      return card;
    }
    const refresh = page.getByRole('button', { name: 'Refresh' });
    if (await refresh.isVisible().catch(() => false)) {
      await refresh.click();
    }
    await page.waitForTimeout(2000);
  }
  return card;
}

async function resetDoctorDeskSession(page) {
  await page.evaluate(() => {
    sessionStorage.removeItem('doctor_desk_active_visit_id');
    sessionStorage.removeItem('doctor_desk_left_via');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
}

async function prepareDoctorDesk(page) {
  await resetDoctorDeskSession(page);

  await page.waitForResponse(
    (resp) => resp.url().includes('doctor.queue') && resp.ok(),
    { timeout: 20000 },
  ).catch(() => {});

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const loading = page.getByText('Loading consult');
    if (await loading.isVisible().catch(() => false)) {
      await expect(loading).toBeHidden({ timeout: 20000 });
    }

    const completeBtn = page.locator('#nc-doctor-complete-btn');
    if (await completeBtn.isVisible().catch(() => false) && await completeBtn.isEnabled().catch(() => false)) {
      await completeBtn.click();
      await expect(page.locator('#nc-doctor-routing-modal')).toBeVisible();
      const labCheckbox = page.locator('#nc-routing-lab');
      if (await labCheckbox.isChecked().catch(() => false)) {
        await labCheckbox.uncheck();
      }
      const rxCheckbox = page.locator('#nc-routing-rx');
      if (await rxCheckbox.isChecked().catch(() => false)) {
        await rxCheckbox.uncheck();
      }
      await page.locator('#nc-routing-confirm').click();
      await expect(page.locator('#nc-doctor-routing-modal')).toBeHidden({ timeout: 15000 });
      await page.getByRole('button', { name: 'Refresh' }).click();
      await page.waitForTimeout(1000);
      continue;
    }
    break;
  }
}

function credentials() {
  return {
    reception: {
      username: process.env.TEST_USERNAME_RECEPTION || 'reception_user',
      password: process.env.TEST_PASSWORD_RECEPTION || 'test_pass',
    },
    nurse: {
      username: process.env.TEST_USERNAME_NURSE || 'nurse_user',
      password: process.env.TEST_PASSWORD_NURSE || 'test_pass',
    },
    doctor: {
      username: process.env.TEST_USERNAME_DOCTOR || 'doctor_user',
      password: process.env.TEST_PASSWORD_DOCTOR || 'test_pass',
    },
    pharmacy: {
      username: process.env.TEST_USERNAME_PHARMACY || 'pharmacy_user',
      password: process.env.TEST_PASSWORD_PHARMACY || 'test_pass',
    },
    cashier: {
      username: process.env.TEST_USERNAME_CASHIER || 'cashier_user',
      password: process.env.TEST_PASSWORD_CASHIER || 'test_pass',
    },
  };
}

test.describe('New Clinic Pharm Ops Golden Path', () => {
  test.beforeAll(() => {
    const script = path.join(
      __dirname,
      '../../../../interface/modules/custom_modules/oe-module-new-clinic/scripts/e2e-prep-golden-path.php',
    );
    const php = process.env.PHP_BIN || 'C:\\xampp\\php\\php.exe';
    execSync(`"${php}" "${script}"`, { stdio: 'inherit' });
  });

  test('formulary quick Rx, dispense, label, and pharmacy complete', async ({ page }) => {
    const patient = generatePatientName();
    const creds = credentials();
    let visitClosed = false;

    await test.step('Register patient and start visit', async () => {
      await login(page, creds.reception.username, creds.reception.password);
      await page.goto(`${MODULE_BASE}/front-desk.php`);
      await registerAndStartVisit(page, patient);
    });

    await test.step('Enter vitals in triage', async () => {
      await logout(page);
      await login(page, creds.nurse.username, creds.nurse.password);
      await page.goto(`${MODULE_BASE}/triage.php`);

      const triageCard = await waitForQueueCard(page, patient.lname);
      await triageCard.click();
      await expect(page.locator('#nc-triage-active-pane')).toContainText(patient.lname, { timeout: 15000 });

      const startTriage = page.getByRole('button', { name: 'Start triage' });
      if (await startTriage.isVisible().catch(() => false)) {
        await startTriage.click();
        await page.waitForTimeout(500);
      }

      await page.fill('#nc-vitals-bps', '120');
      await page.fill('#nc-vitals-bpd', '80');
      await page.fill('#nc-vitals-pulse', '72');
      await page.fill('#nc-vitals-temperature', '37.0');
      await page.fill('#nc-vitals-weight', '70');
      await page.fill('#nc-vitals-respiration', '16');

      // The triage desk auto-saves vitals — click Save if still enabled, then
      // wait for the SAVED STATE and await the send mutation itself.
      const saveButton = page.getByRole('button', { name: 'Save vitals' });
      if (await saveButton.isEnabled().catch(() => false)) {
        await saveButton.click().catch(() => {});
      }
      await expect(page.getByText(/Vitals saved/i).first()).toBeVisible({ timeout: 30000 });
      const sendResp = page.waitForResponse(
        (resp) => resp.url().includes('triage.send_doctor') && resp.ok(),
        { timeout: 30000 },
      );
      await page.getByRole('button', { name: 'Send to doctor' }).click();
      await sendResp;
    });

    await test.step('Doctor quick prescribe and route to pharmacy', async () => {
      await logout(page);
      await login(page, creds.doctor.username, creds.doctor.password);
      await page.goto(`${MODULE_BASE}/doctor.php`);
      await prepareDoctorDesk(page);

      const doctorCard = await waitForQueueCard(page, patient.lname);
      await doctorCard.click();
      await expect(page.locator('#nc-doctor-active-pane')).toContainText(
        patient.lname,
        { timeout: 20000 },
      );

      const catalogResp = page.waitForResponse(
        (resp) => resp.url().includes('formulary_rx_catalog') && resp.ok(),
        { timeout: 30000 },
      );
      // Desk redesign renamed the shortcut: 'Quick prescribe' → 'Prescribe'.
      await page.getByRole('button', { name: 'Prescribe' }).click();
      await expect(page.locator('#nc-doctor-formulary-rx-modal')).toBeVisible({ timeout: 10000 });
      await catalogResp;

      // Formulary lists multiple Paracetamol formulations — take the first.
      const paracetamolLabel = page.locator('label[for^="nc-formulary-rx-drug-"]').filter({ hasText: 'Paracetamol' }).first();
      await expect(paracetamolLabel).toBeVisible({ timeout: 20000 });
      const drugInputId = await paracetamolLabel.getAttribute('for');
      await page.locator(`#${drugInputId}`).check();

      const placeWait = page.waitForResponse(
        (resp) => resp.url().includes('formulary_rx_place') && resp.ok(),
        { timeout: 20000 },
      );
      await page.locator('#nc-formulary-rx-place').click();
      await placeWait;
      await expect(page.locator('#nc-doctor-formulary-rx-modal')).toBeHidden({ timeout: 15000 });
      await expect(page.locator('#nc-doctor-active-pane')).toContainText('Paracetamol', {
        timeout: 10000,
      });

      await page.locator('#nc-doctor-complete-btn').click();
      await expect(page.locator('#nc-doctor-routing-modal')).toBeVisible();

      const labCheckbox = page.locator('#nc-routing-lab');
      if (await labCheckbox.isChecked().catch(() => false)) {
        await labCheckbox.uncheck();
      }

      const rxCheckbox = page.locator('#nc-routing-rx');
      await rxCheckbox.check();
      await page.locator('#nc-routing-confirm').click();
      await expect(page.locator('#nc-doctor-routing-modal')).toBeHidden({ timeout: 15000 });
    });

    await test.step('Pharmacy dispense with label', async () => {
      await logout(page);
      await login(page, creds.pharmacy.username, creds.pharmacy.password);
      await page.goto(`${MODULE_BASE}/pharmacy.php`);

      const pharmacyCard = await waitForQueueCard(page, patient.lname);
      await pharmacyCard.click();
      await expect(page.locator('#nc-pharmacy-active-pane')).toContainText(
        patient.lname,
        { timeout: 15000 },
      );

      const takeBtn = page.locator('#nc-pharmacy-take-btn');
      if (await takeBtn.isVisible().catch(() => false)) {
        await takeBtn.click();
        await page.waitForTimeout(1000);
      }

      await expect(page.locator('#nc-pharmacy-active-pane')).toContainText('Paracetamol', {
        timeout: 15000,
      });

      const dispenseBtn = page.getByRole('button', { name: /Dispense Paracetamol/i });
      await expect(dispenseBtn).toBeVisible({ timeout: 10000 });
      await dispenseBtn.click();

      const drawer = page.locator('#nc-pharmops-dispense-drawer');
      await expect(drawer).toBeVisible({ timeout: 15000 });
      await expect(drawer.locator('#nc-pharmops-dispense-qty')).toBeVisible({ timeout: 20000 });

      const popupPromise = page.waitForEvent('popup', { timeout: 20000 }).catch(() => null);

      await drawer.getByRole('button', { name: 'Confirm dispense' }).click();
      await expect(page.getByRole('heading', { name: 'Confirm dispense' })).toBeVisible();
      await page.getByRole('button', { name: 'Dispense', exact: true }).click();

      await expect(drawer.getByRole('status')).toContainText(/Dispensed/i, { timeout: 20000 });

      const popup = await popupPromise;
      if (popup) {
        await expect(popup).toHaveURL(/dispense-label\.php/, { timeout: 15000 });
        await popup.close();
      } else {
        await expect(drawer).toContainText(/label opened|Print label/i);
      }

      // De-bootstrapped drawer: target the Close button by role, not btn-* classes.
      await drawer.getByRole('button', { name: 'Close' }).first().click();
      await expect(drawer).toBeHidden({ timeout: 10000 });

      await page.waitForResponse(
        (resp) => resp.url().includes('pharmacy.select') && resp.ok(),
        { timeout: 15000 },
      ).catch(() => {});

      const completeResponse = page.waitForResponse(
        (resp) => resp.url().includes('pharmacy.complete'),
        { timeout: 20000 },
      );
      await page.locator('#nc-pharmacy-complete-btn').click();
      const firstComplete = await completeResponse;
      const firstBody = await firstComplete.json().catch(() => ({}));

      if (!firstBody.success) {
        const code = firstBody?.data?.code;
        if (code === 'encounter_unsigned') {
          await expect(page.getByRole('heading', { name: 'E-Sign override' })).toBeVisible({
            timeout: 10000,
          });
          await page.locator('#nc-pharmacy-esign-reason').fill(
            'E2E pharm golden path — unsigned consult override',
          );
          const overrideResponse = page.waitForResponse(
            (resp) => resp.url().includes('pharmacy.complete'),
            { timeout: 20000 },
          );
          await page.getByRole('button', { name: 'Complete with override' }).click();
          const secondComplete = await overrideResponse;
          const secondBody = await secondComplete.json().catch(() => ({}));
          if (!secondBody.success) {
            throw new Error(`Pharmacy complete override failed: ${JSON.stringify(secondBody)}`);
          }
        } else if (code === 'rx_undispensed') {
          throw new Error(`Rx still undispensed after dispense: ${JSON.stringify(firstBody)}`);
        } else {
          throw new Error(`Pharmacy complete failed: ${JSON.stringify(firstBody)}`);
        }
      }

      await expect(page.locator(`[class*="queue-card"]:has-text("${patient.lname}")`)).toHaveCount(0, {
        timeout: 20000,
      });
    });

    await test.step('Cashier payment or zero close', async () => {
      await logout(page);
      await login(page, creds.cashier.username, creds.cashier.password);
      await page.goto(`${MODULE_BASE}/cashier.php`);

      const cashierCard = await waitForQueueCard(page, patient.lname);
      await cashierCard.click();
      await completeCashierVisit(page, patient, 'E2E pharm golden path — settle balance');
      visitClosed = true;
    });

    await test.step('Verify journey completed', async () => {
      expect(visitClosed).toBe(true);
      // eslint-disable-next-line no-console
      console.log(`Pharm ops golden path OK: ${patient.fullName}`);
    });
  });
});
