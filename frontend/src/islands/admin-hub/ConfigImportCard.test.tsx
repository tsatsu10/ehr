import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfigImportCard } from './ConfigImportCard';

const meta = {
  can_export: true,
  export_format: 'new_clinic_m6_config',
  export_version: 1,
  can_import: true,
  import_blocked_reason: null,
};

describe('ConfigImportCard', () => {
  it('shows preview summary and confirm when dry-run result present', () => {
    render(
      <ConfigImportCard
        meta={meta}
        scopeLabel="Pilot clinic"
        preview={{
          dry_run: true,
          summary: {
            settings_planned: 12,
            fees_planned: 5,
            visit_types_planned: 3,
          },
        }}
        previewing={false}
        importing={false}
        onChooseFile={vi.fn()}
        onConfirmImport={vi.fn()}
        onClearPreview={vi.fn()}
      />,
    );

    expect(screen.getByText('12 clinic settings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply import to this site/i })).toBeEnabled();
  });

  it('disables import when super-only blocked', () => {
    render(
      <ConfigImportCard
        meta={{
          ...meta,
          can_import: false,
          import_blocked_reason: 'Config import requires OpenEMR administrator (super) access.',
        }}
        scopeLabel="Pilot clinic"
        preview={null}
        previewing={false}
        importing={false}
        onChooseFile={vi.fn()}
        onConfirmImport={vi.fn()}
        onClearPreview={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Choose M6 config JSON/i })).toBeDisabled();
    expect(screen.getByText(/super/i)).toBeInTheDocument();
  });

  it('fires onConfirmImport when apply clicked', () => {
    const onConfirmImport = vi.fn();

    render(
      <ConfigImportCard
        meta={meta}
        scopeLabel="Pilot clinic"
        preview={{
          dry_run: true,
          summary: { settings_planned: 1, fees_planned: 0, visit_types_planned: 0 },
        }}
        previewing={false}
        importing={false}
        onChooseFile={vi.fn()}
        onConfirmImport={onConfirmImport}
        onClearPreview={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Apply import to this site/i }));
    expect(onConfirmImport).toHaveBeenCalled();
  });
});
