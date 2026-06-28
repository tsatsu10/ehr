# New Clinic E2E Tests

End-to-end test suite for New Clinic V1 module golden path workflow.

## Prerequisites

### Local Testing (Playwright + XAMPP)
```bash
npm install --save-dev @playwright/test
npx playwright install
```

### Docker Environment (Recommended)
```bash
cd docker/development-easy
docker compose up -d
```

## Test Structure

```
tests/e2e/new-clinic/
├── README.md                    # This file
├── playwright.config.js         # Playwright configuration
├── helpers/                     # Test helpers and utilities
│   ├── auth.js                  # Login/logout helpers
│   ├── selectors.js             # Common selectors
│   └── test-data.js             # Test data generators
└── specs/                       # Test specifications
    ├── golden-path.spec.js      # Full workflow test
    ├── front-desk.spec.js       # Front desk specific tests
    ├── doctor-desk.spec.js      # Doctor desk specific tests
    └── cashier.spec.js          # Cashier specific tests
```

## Golden Path Workflow (Test 23)

The E2E golden path test covers the complete patient journey from registration to payment:

### Step 1: Registration (Front Desk)
- Login as reception user
- Navigate to Front Desk (`/public/front-desk.php`)
- Search for new patient (should not exist)
- Click "Quick add" registration
- Fill registration form:
  - First name: `Test`
  - Last name: `Patient{timestamp}`
  - DOB: `1990-01-01`
  - Sex: `Male`
  - Phone: `0244001122`
- Submit registration
- Verify patient created

### Step 2: Start Visit (Front Desk)
- Select newly created patient from search results
- Select visit type: "OPD"
- Enter chief complaint: "Headache for 2 days"
- Click "Start visit"
- Verify:
  - Visit started successfully
  - Queue number assigned
  - Queue slip printed (if enabled)

### Step 3: Vitals Entry (Triage)
- Navigate to Triage (`/public/triage.php`)
- Verify patient appears in "waiting" queue
- Click patient card to take patient
- Verify patient moved to "in triage" state
- Enter vitals:
  - BP: `120/80`
  - Pulse: `72`
  - Temperature: `37.0`
  - Respiration: `16`
- Click "Save and send to doctor"
- Verify patient moved to "ready_for_doctor" state

### Step 4: Doctor Consult (Doctor Desk)
- Navigate to Doctor Desk (`/public/doctor.php`)
- Verify patient appears in "ready_for_doctor" queue
- Click "Take patient"
- Verify:
  - Patient context banner displays
  - Vitals shown in banner
  - Chief complaint displayed
- Click "SOAP note" shortcut
- Enter SOAP note in core encounter form:
  - Subjective: "Patient reports headache"
  - Objective: "Vital signs stable"
  - Assessment: "Tension headache"
  - Plan: "Paracetamol 500mg TDS x 3 days"
- Return to Doctor Desk
- Click "Order lab" shortcut
- Select lab test: "Complete Blood Count (CBC)"
- Return to Doctor Desk
- Click "Complete consult"
- Verify routing modal appears
- Check "Needs lab" checkbox
- Click "Confirm and route"
- Verify patient moved to "ready_for_lab" state

### Step 5: Lab Results (Lab Desk)
- Navigate to Lab (`/public/lab.php`)
- Verify patient appears in "ready_for_lab" queue
- Click patient card to take patient
- Click "Results" shortcut
- Enter lab results (simplified):
  - Hemoglobin: `13.5`
  - WBC: `7.2`
- Mark as "Results ready"
- Click "Lab complete"
- Verify patient moved to "ready_for_payment" state

### Step 6: Payment (Cashier)
- Navigate to Cashier (`/public/cashier.php`)
- Verify patient appears in "ready_for_payment" queue
- Click patient card
- Verify billing items listed:
  - Consultation fee
  - Lab test fee
- Enter payment amount: `50.00`
- Click "Record payment"
- Verify:
  - Receipt number assigned
  - Receipt displayed
  - Patient moved to "completed" state

### Step 7: Reconciliation (Admin)
- Navigate to Admin (`/public/admin.php`)
- Scroll to "Reconciliation" section
- Click "Run reconciliation now"
- Wait for reconciliation to complete
- Verify:
  - Status: "OK"
  - Module total matches Core AR total
  - Delta: 0.00

## Running Tests

### Full Test Suite
```bash
npm run test:e2e-new-clinic
```

### Single Test File
```bash
npx playwright test tests/e2e/new-clinic/specs/golden-path.spec.js
```

### Headed Mode (See Browser)
```bash
npx playwright test --headed
```

### Debug Mode
```bash
npx playwright test --debug
```

## Environment Variables

Create `.env.test` in project root:
```env
TEST_BASE_URL=http://localhost/openemr
TEST_USERNAME_RECEPTION=reception_user
TEST_PASSWORD_RECEPTION=test_pass
TEST_USERNAME_NURSE=nurse_user
TEST_PASSWORD_NURSE=test_pass
TEST_USERNAME_DOCTOR=doctor_user
TEST_PASSWORD_DOCTOR=test_pass
TEST_USERNAME_LAB=lab_user
TEST_PASSWORD_LAB=test_pass
TEST_USERNAME_CASHIER=cashier_user
TEST_PASSWORD_CASHIER=test_pass
TEST_USERNAME_ADMIN=admin
TEST_PASSWORD_ADMIN=pass
TEST_FACILITY_ID=3
```

## Known Issues & Workarounds

### Issue: Core Form Interaction
**Problem:** Core OpenEMR forms (SOAP, lab orders) use legacy iframes  
**Workaround:** Navigate to forms via shortcuts, wait for page load, use form-specific selectors

### Issue: Queue Polling
**Problem:** Queue updates via 30s polling may cause delays  
**Workaround:** Use `page.waitForTimeout(2000)` after state transitions, or trigger manual refresh

### Issue: Session Management
**Problem:** Switching between users requires logout/login  
**Workaround:** Use separate browser contexts for each role, or sequential role tests

### Issue: Data Cleanup
**Problem:** Test patients persist in database  
**Workaround:** Use unique timestamps in patient names, or clean up in `afterEach` hook

## Success Criteria (Test 23)

Test 23 passes when:
- ✅ E2E test infrastructure exists (this file + specs)
- ✅ Golden path workflow documented with verification points
- ✅ At least 1 automated test spec file exists
- ✅ Test can be run manually to verify workflow
- ✅ CI/CD integration possible

## Future Enhancements

- [ ] Visual regression testing (Percy, BackstopJS)
- [ ] API-level E2E tests (faster than browser tests)
- [ ] Parameterized tests for different visit types
- [ ] Performance testing (page load times)
- [ ] Accessibility testing (axe-core)

## Maintenance

Update this document when:
- New desks added to workflow
- UI selectors change
- New verification points added
- Environment setup changes
