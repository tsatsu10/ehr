/// <reference types="vite/client" />

declare module '*.css';

// ── Legacy jQuery bridge declarations ────────────────────────────────────────

interface NewClinicVisitBoardGlobal {
  init: (root: HTMLElement | null) => void;
}

interface Window {
  NewClinicVisitBoard?: NewClinicVisitBoardGlobal;
}
