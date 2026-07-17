import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HardAssignOverrideModal } from './HardAssignOverrideModal';
import type { DoctorQueueCard } from '@core/types';

describe('HardAssignOverrideModal', () => {
  it('renders nothing when there is no card', () => {
    const { container } = render(
      <HardAssignOverrideModal card={null} submitting={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('names the assigned provider and disables confirm until a reason is typed', () => {
    render(
      <HardAssignOverrideModal
        card={{ hard_assigned_provider_name: 'Dr. Boateng' } as DoctorQueueCard}
        submitting={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText('Dr. Boateng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take with override' })).toBeDisabled();
  });

  it('falls back to a generic label when no provider name is on the card', () => {
    render(
      <HardAssignOverrideModal card={{} as DoctorQueueCard} submitting={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByText('another doctor')).toBeInTheDocument();
  });

  it('enables confirm once a 3+ char reason is entered and submits the trimmed reason', () => {
    const onConfirm = vi.fn();
    render(
      <HardAssignOverrideModal
        card={{ hard_assigned_provider_name: 'Dr. Boateng' } as DoctorQueueCard}
        submitting={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: '  cover for lunch  ' } });
    const confirmBtn = screen.getByRole('button', { name: 'Take with override' });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith('cover for lunch');
  });
});
