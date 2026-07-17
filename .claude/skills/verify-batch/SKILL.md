---
name: verify-batch
description: Run the New Clinic verification gates in the correct order for whatever changed in this batch (frontend islands, module PHP, schema/ACL, UI), and only then report done
---

# New Clinic batch verification

Run this after completing a batch of changes, before telling the user anything is "done".
Never claim done for backend PHP without the composer verifier passing, or for UI without a
build + asset version bump + a hard-refresh instruction.

## 1. Identify what changed in this batch

- Frontend island code under `frontend/src/` → run the **Frontend** gate
- Module PHP under `interface/modules/custom_modules/oe-module-new-clinic/` → run the **Backend** gate
- `install.sql`, `upgrade_sql`, or ACL definitions → run the **Schema/ACL** gate
- Any user-visible change → finish with the **Browser smoke** gate
- Shell-CSS-only changes (`public/assets/css/*.css`) → version bump only, no rebuild

Multiple categories → run all matching gates, in the order below.

## 2. Frontend gate (PowerShell — chain with `;`, never `&&`)

```powershell
cd c:\xampp\htdocs\openemr\frontend
npm test -- --run src/islands/<island>   # scoped Vitest for each touched island first
npm run check                            # lint + typecheck + full vitest
npm run build                            # Vite -> public/assets/modern/
```

Then bump `interface/modules/custom_modules/oe-module-new-clinic/src/ModuleAssetVersion.php`
(`VERSION = 'YYYYMMDD<slug>'`) — **once per batch, not per file**. Tell the user to
hard-refresh (Ctrl+Shift+R) and, if they report "not fixed", first compare the loaded `?v=`
in the failing asset URL against the new version before debugging anything else.

## 3. Backend gate

```powershell
cd c:\xampp\htdocs\openemr
composer verify:new-clinic
```

Must print `RESULT: PASS` including AjaxController bootstrap. Then targeted tests:

```powershell
vendor\bin\phpunit -c phpunit.xml tests\Tests\Unit\Modules\NewClinic
vendor\bin\phpunit -c phpunit.xml --filter "<ServiceName>"
composer test:new-clinic-mandatory
```

If any `__construct` was touched, pay attention to the ctor-cycle scan — constructor cycles
crash Apache children (`ERR_CONNECTION_RESET`, exit 3221225725 in
`C:\xampp\apache\logs\error.log`).

## 4. Schema/ACL gate

```powershell
C:\xampp\php\php.exe interface\modules\custom_modules\oe-module-new-clinic\bin\upgrade_sql.php
C:\xampp\php\php.exe interface\modules\custom_modules\oe-module-new-clinic\bin\install_acl.php
```

New tables belong in the module's `install.sql` with `#IfNotRow2D` guards. A "missing table"
error on a working feature almost always means `upgrade_sql.php` was skipped.

## 5. Browser smoke

Hard-refresh http://localhost/openemr/ (login with `?site=default`), open the changed desk,
DevTools → Network: every `ajax.php` action returns **200** (not 500, not
`ERR_CONNECTION_RESET`), no white screen, no React error overlay.

## 6. Area sign-off smokes (when that area was touched)

- M10 registry: `composer registry-signoff`
- People & Access hub: `composer people-signoff`
- Otherwise check the module's `scripts/` folder for the matching HTTP smoke or pilot-enable script.

## 7. Report

State which gates ran, their results verbatim (PASS/FAIL, test counts), the new asset
version string, and the hard-refresh instruction. CI green does **not** replace
`composer verify:new-clinic` — say so if only CI has run.
