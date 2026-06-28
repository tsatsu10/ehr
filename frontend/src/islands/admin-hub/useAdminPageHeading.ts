import { useEffect } from 'react';

function bindClick(id: string, handler: () => void): (() => void) | undefined {
  const el = document.getElementById(id);
  if (!el) return undefined;
  el.addEventListener('click', handler);
  return () => el.removeEventListener('click', handler);
}

interface AdminPageHeadingOptions {
  dirty: boolean;
  statusText: string;
  onSave: () => void;
}

/** Wire Twig page-heading save button and status for Admin Hub. */
export function useAdminPageHeading({
  dirty,
  statusText,
  onSave,
}: AdminPageHeadingOptions): void {
  useEffect(() => {
    const saveBtn = document.getElementById('nc-admin-save') as HTMLButtonElement | null;
    if (saveBtn) saveBtn.disabled = !dirty;
  }, [dirty]);

  useEffect(() => {
    const statusEl = document.getElementById('nc-admin-status');
    if (statusEl) statusEl.textContent = statusText;
  }, [statusText]);

  useEffect(() => {
    const cleanup = bindClick('nc-admin-save', onSave);
    return () => cleanup?.();
  }, [onSave]);
}
