/**
 * Phase 0 proof-of-concept island.
 *
 * Renders a small static badge above the existing jQuery Visit Board to
 * prove the Vite + React + Tailwind pipeline is wired correctly. No
 * network calls, no state, no replacement of existing UI.
 *
 * Phase 1 will replace this file with the first real island
 * (shared QueueCard component).
 */

export interface VisitBoardHelloProps {
  /** Display label injected from the Twig page (defaults to "Phase 0"). */
  label?: string;
}

export function VisitBoardHello({ label = 'Phase 0' }: VisitBoardHelloProps) {
  return (
    <div role="status" aria-live="polite" className="oe-island-hello">
      <span className="oe-island-hello__dot" aria-hidden="true" />
      <span>React island OK — {label}</span>
    </div>
  );
}
