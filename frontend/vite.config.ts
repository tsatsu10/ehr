import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

/**
 * Vite Phase 0 config.
 *
 * Build output is written directly into the New Clinic module's
 * public/assets/modern/ folder so existing PageController-provided
 * {{ assets_url }} can serve the new bundles without any change to
 * config/config.yaml. When other modules join the modern pipeline
 * (Phase 1+), we will add per-module input entries here and either
 * keep one shared outDir or move to a global /public/assets/modern/
 * with config.yaml asset keys.
 *
 * Manifest is enabled so PHP can (later) read hashed filenames if we
 * want fingerprinted bundles. For now the Twig pages reference the
 * unhashed entry name directly via the entryFileNames rule below.
 */
const moduleAssetsModern = resolve(
  here,
  '../interface/modules/custom_modules/oe-module-new-clinic/public/assets/modern'
);

/**
 * One entry per island. The key becomes both the JS filename and, via
 * `assetFileNames` below, the CSS filename so Twig pages can reference
 * both as `<name>.js` and `<name>.css` without reading the manifest.
 *
 * To add Phase 1 islands: append entries here and register a flag in
 * the New Clinic admin config (see Documentation/FRONTEND_MODULE_GUIDE.md).
 */
const islands: Record<string, string> = {
  'visit-board':       resolve(here, 'src/islands/visit-board/index.tsx'),
  'triage-desk':       resolve(here, 'src/islands/triage-desk/index.tsx'),
  'doctor-desk':       resolve(here, 'src/islands/doctor-desk/index.tsx'),
  'cashier-desk':      resolve(here, 'src/islands/cashier-desk/index.tsx'),
  'lab-desk':          resolve(here, 'src/islands/lab-desk/index.tsx'),
  'pharmacy-desk':     resolve(here, 'src/islands/pharmacy-desk/index.tsx'),
  'front-desk':        resolve(here, 'src/islands/front-desk/index.tsx'),
  'patient-registry':  resolve(here, 'src/islands/patient-registry/index.tsx'),
  'daily-reports':     resolve(here, 'src/islands/daily-reports/index.tsx'),
  'communications-hub': resolve(here, 'src/islands/communications-hub/index.tsx'),
  'admin-hub':           resolve(here, 'src/islands/admin-hub/index.tsx'),
  'patient-chart':       resolve(here, 'src/islands/patient-chart/index.tsx'),
  'lab-ops':             resolve(here, 'src/islands/lab-ops/index.tsx'),
  'pharm-ops':           resolve(here, 'src/islands/pharm-ops/index.tsx'),
  'chart-depth':         resolve(here, 'src/islands/chart-depth/index.tsx'),
  'bill-ops':            resolve(here, 'src/islands/bill-ops/index.tsx'),
  'bill-ops-correct':    resolve(here, 'src/islands/bill-ops/index-correct.tsx'),
  'report-hub':          resolve(here, 'src/islands/report-hub/index.tsx'),
  'queue-bridge':        resolve(here, 'src/islands/queue-bridge/index.tsx'),
  'scheduling':          resolve(here, 'src/islands/scheduling/index.tsx'),
  'clinical-doc':        resolve(here, 'src/islands/clinical-doc/index.tsx'),
  'encounter-consult':   resolve(here, 'src/islands/encounter-consult/index.tsx'),
  'my-profile':          resolve(here, 'src/islands/my-profile/index.tsx'),
};

export default defineConfig({
  // Relative base so lazy chunks/CSS resolve under .../public/assets/modern/
  // when islands are served from deep OpenEMR module URLs (not domain root).
  base: './',
  plugins: [react(), tailwind()],
  resolve: {
    alias: {
      '@': resolve(here, 'src'),
      '@core': resolve(here, 'src/core'),
      '@islands': resolve(here, 'src/islands'),
      '@components': resolve(here, 'src/components'),
    },
  },
  build: {
    target: 'es2022',
    outDir: moduleAssetsModern,
    emptyOutDir: true,
    manifest: true,
    sourcemap: true,
    rollupOptions: {
      input: islands,
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        /**
         * Island CSS gets a predictable unhashed name matching its JS entry
         * (`visit-board.js` → `visit-board.css`) so Twig pages
         * can add a <link> tag without reading the manifest at runtime.
         *
         * Other assets (fonts, images, shared chunk CSS) keep the hashed
         * pattern for cache busting.
         */
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.some((n) => n.endsWith('.css'))) {
            const islandKey = Object.keys(islands).find((key) =>
              assetInfo.originalFileNames?.some((f) =>
                f.includes(`/islands/${key}/`)
              )
            );
            if (islandKey !== undefined) return `${islandKey}.css`;
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
