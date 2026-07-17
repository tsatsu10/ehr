import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoutingOverrideModal } from './RoutingOverrideModal';
import type { DoctorQueueCard } from '@core/types';

describe('RoutingOverrideModal', () => {
  it('renders nothing when there is no card', () => {
    const { container } = render(
      <RoutingOverrideModal card={null} submitting={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('names the suggested provider and disables confirm until a reason is typed', () => {
    render(
      <RoutingOverrideModal
        card={{ routing_suggested_provider_name: 'Dr. Mensah' } as DoctorQueueCard}
        submitting={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText('Dr. Mensah')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take anyway' })).toBeDisabled();
  });

  it('enables confirm once a 3+ char reason is entered and submits the trimmed reason', () => {
    const onConfirm = vi.fn();
    render(
      <RoutingOverrideModal
        card={{ routing_suggested_provider_name: 'Dr. Mensah' } as DoctorQueueCard}
        submitting={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'patient requested me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Take anyway' }));
    expect(onConfirm).toHaveBeenCalledWith('patient requested me');
  });

  it('shows the submitting label while submitting', () => {
    render(
      <RoutingOverrideModal
        card={{ routing_suggested_provider_name: 'Dr. Mensah' } as DoctorQueueCard}
        submitting
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Taking…' })).toBeInTheDocument();
  });
});
