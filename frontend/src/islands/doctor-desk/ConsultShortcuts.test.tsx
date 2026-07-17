import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConsultShortcuts } from './ConsultShortcuts';

function baseProps() {
  return {
    blocked: false,
    runShortcut: vi.fn(),
  };
}

describe('ConsultShortcuts', () => {
  it('renders the four always-on primary actions', () => {
    render(<ConsultShortcuts {...baseProps()} />);
    expect(screen.getByRole('button', { name: /Encounter/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Order lab/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Rx$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chart/ })).toBeInTheDocument();
  });

  it('disables every primary action when blocked', () => {
    render(<ConsultShortcuts {...baseProps()} blocked />);
    expect(screen.getByRole('button', { name: /Encounter/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Rx$/ })).toBeDisabled();
  });

  it('runs the encounter shortcut through runShortcut when clicked', () => {
    const runShortcut = vi.fn();
    render(<ConsultShortcuts {...baseProps()} runShortcut={runShortcut} />);
    fireEvent.click(screen.getByRole('button', { name: /Encounter/ }));
    expect(runShortcut).toHaveBeenCalledWith('encounter');
  });

  it('does not call runShortcut when blocked', () => {
    const runShortcut = vi.fn();
    render(<ConsultShortcuts {...baseProps()} runShortcut={runShortcut} blocked />);
    fireEvent.click(screen.getByRole('button', { name: /Encounter/ }));
    expect(runShortcut).not.toHaveBeenCalled();
  });

  it('opens the lab panel drawer instead of the legacy shortcut when lab panel ordering is enabled', () => {
    const runShortcut = vi.fn();
    const onOpenLabPanel = vi.fn();
    render(
      <ConsultShortcuts
        {...baseProps()}
        runShortcut={runShortcut}
        labPanelOrderEnabled
        onOpenLabPanel={onOpenLabPanel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Lab order/ }));
    expect(onOpenLabPanel).toHaveBeenCalled();
    expect(runShortcut).not.toHaveBeenCalled();
  });

  it('opens the formulary Rx drawer instead of the legacy shortcut when formulary Rx is enabled', () => {
    const runShortcut = vi.fn();
    const onOpenFormularyRx = vi.fn();
    render(
      <ConsultShortcuts
        {...baseProps()}
        runShortcut={runShortcut}
        formularyRxEnabled
        onOpenFormularyRx={onOpenFormularyRx}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Prescribe/ }));
    expect(onOpenFormularyRx).toHaveBeenCalled();
    expect(runShortcut).not.toHaveBeenCalled();
  });

  it('shows a Documentation hub "More" link only when the clinical doc hub is enabled', () => {
    const { rerender } = render(<ConsultShortcuts {...baseProps()} />);
    expect(screen.queryByRole('button', { name: 'Documentation hub' })).not.toBeInTheDocument();

    rerender(<ConsultShortcuts {...baseProps()} clinicalDocHubEnabled />);
    expect(screen.getByRole('button', { name: 'Documentation hub' })).toBeInTheDocument();
  });

  it('shows a Patient handouts link when onOpenPatientEducation is provided', () => {
    const onOpenPatientEducation = vi.fn();
    render(<ConsultShortcuts {...baseProps()} onOpenPatientEducation={onOpenPatientEducation} />);
    fireEvent.click(screen.getByRole('button', { name: 'Patient handouts' }));
    expect(onOpenPatientEducation).toHaveBeenCalled();
  });
});
