/**
 * Slide-over patient search drawer (triage Find patient, etc.).
 */

import { useEffect, useRef } from 'react';
import { PatientSearchWidget } from '@islands/front-desk/PatientSearchWidget';

export interface FindPatientDrawerProps {
  open: boolean;
  onClose: () => void;
  ajaxUrl: string;
  csrfToken: string;
  onSelectPatient: (pid: number) => void;
  title?: string;
}

export function FindPatientDrawer({
  open,
  onClose,
  ajaxUrl,
  csrfToken,
  onSelectPatient,
  title = 'Find patient',
}: FindPatientDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLInputElement>('#nc-search-input')?.focus();
    }, 80);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div id="nc-triage-find-drawer" className="nc-triage-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="nc-triage-drawer-backdrop"
        id="nc-triage-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="nc-triage-drawer-panel card shadow" ref={panelRef}>
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>{title}</strong>
          <button type="button" className="close" id="nc-triage-drawer-close" aria-label="Close" onClick={onClose}>
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div className="card-body">
          <PatientSearchWidget
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            selectedPid={null}
            autoSelectFirst={false}
            showRegisterButton={false}
            title={title}
            onSelectPatient={(pid) => {
              onSelectPatient(pid);
              onClose();
            }}
            onRegisterPatient={() => {
              /* triage drawer: registration not offered */
            }}
          />
        </div>
      </div>
    </div>
  );
}
