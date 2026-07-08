/**
 * Shared types for the OpenEMR modern frontend.
 *
 * Domain modules live under ./types/; this file re-exports everything so
 * existing `@core/types` imports stay stable (AUDIT-9a).
 */

export * from './types/common';
export * from './types/patient';
export * from './types/chips';
export * from './types/visit-board';
export * from './types/triage';
export * from './types/doctor';
export * from './types/cashier';
export * from './types/lab';
export * from './types/pharmacy';
export * from './types/front-desk';
