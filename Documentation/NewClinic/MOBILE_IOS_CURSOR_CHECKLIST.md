# Cursor iOS — New Clinic verification checklist

Use after coding from the **Cursor iOS app**. The phone is an editor; your **Windows XAMPP box** (or CI) is the verifier.

## Quick flow

```text
Code on iOS  →  git push  →  CI green?  →  desktop verify  →  browser smoke  →  merge
```

## 1. Push

- [ ] Branch pushed to origin (not only local on phone)
- [ ] No stray `.broken` / `.bak` PHP files in `oe-module-new-clinic/src/`
- [ ] One focused concern per branch when possible

## 2. CI (automatic on PR)

Workflow: **New Clinic Verify** (`.github/workflows/new-clinic-verify.yml`)

| Job | What it checks |
|-----|----------------|
| PHP static verify | Syntax, constructor cycles, controller imports, stray artifacts |
| Frontend check + build | Vitest for front-desk, patient-registry, visit-board islands; Vite production build |

**Note:** Full `npm run typecheck` is not in CI yet (repo-wide TS debt). Run locally when touching types.

- [ ] Both jobs green on the PR

**Note:** CI does **not** run AjaxController bootstrap (needs MySQL). That is the desktop step below.

## 3. Desktop gate — backend PHP

From repo root on the XAMPP host (PHP CLI + MySQL running):

```bash
composer verify:new-clinic
```

- [ ] `RESULT: PASS` including `AjaxController bootstrap instantiation`

If this fails with exit `3221225725` on Windows, suspect **constructor recursion** — see `.cursor/rules/new-clinic-mobile-backend-gate.mdc`.

## 4. Desktop gate — frontend only

If you changed islands but not PHP:

```bash
cd frontend
npm run check
npm run build
```

- [ ] Tests pass
- [ ] Build completes
- [ ] `ModuleAssetVersion.php` bumped if user-visible assets changed

## 5. Browser smoke (5 minutes)

On http://localhost/openemr/ (hard-refresh / Ctrl+Shift+R):

- [ ] Open **one desk** you changed (e.g. Front Desk, Visit Board)
- [ ] DevTools → Network: an `ajax.php` action returns **200** (not `ERR_CONNECTION_RESET` or 500)
- [ ] No white screen / React error overlay

## 6. Merge criteria

- [ ] CI green
- [ ] `composer verify:new-clinic` pass (if any PHP under `oe-module-new-clinic/src/` changed)
- [ ] Smoke test pass (if any UI changed)

## Remote preview from phone (optional)

If the dev PC is on and reachable (Tailscale / LAN):

- Open `http://<pc-ip>/openemr/` in Safari on iPhone/iPad
- Cursor iOS edits code; Safari previews — they are separate apps

## Related rules

| Rule | Purpose |
|------|---------|
| `.cursor/rules/new-clinic-mobile-scope.mdc` | What to code vs avoid on iOS |
| `.cursor/rules/new-clinic-mobile-backend-gate.mdc` | PHP constructor/import hygiene |
| `.cursor/rules/new-clinic-big-picture-first.mdc` | Grep all render paths before shipping |
