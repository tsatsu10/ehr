import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DoctorQueueCardBadges } from './DoctorQueueCardBadges';
import type { DoctorQueueCard } from '@core/types';

function card(overrides: Partial<DoctorQueueCard> = {}): DoctorQueueCard {
  return { id: 1, display_name: 'Test', ...overrides } as DoctorQueueCard;
}

describe('DoctorQueueCardBadges', () => {
  it('renders nothing when the card has no badge-worthy fields', () => {
    const { container } = render(<DoctorQueueCardBadges card={card()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an URGENT badge first, ahead of other badges', () => {
    render(<DoctorQueueCardBadges card={card({ is_urgent: 1, skipped_triage: true })} />);
    const badges = screen.getAllByText(/URGENT|Skipped triage/);
    expect(badges[0]).toHaveTextContent('URGENT');
  });

  it('shows an assigned-provider badge', () => {
    render(<DoctorQueueCardBadges card={card({ assigned_provider_name: 'Dr. Owusu' })} />);
    expect(screen.getByText(/Appt: Dr. Owusu/)).toBeInTheDocument();
  });

  it('collapses badges beyond the visible limit behind a "+N more" toggle', () => {
    render(
      <DoctorQueueCardBadges
        card={card({
          is_urgent: 1,
          skipped_triage: true,
          assigned_provider_name: 'Dr. Owusu',
          routing_suggested_provider_name: 'Dr. Mensah',
        })}
      />,
    );
    const toggle = screen.getByText('+2 more');
    expect(toggle).toBeInTheDocument();
    // The overflow badges live inside a <details> — present in the DOM but
    // visually collapsed until the summary is toggled, not removed.
    expect(toggle.closest('details')).toContainElement(screen.getByText(/Appt: Dr. Owusu/));
  });

  it('shows a hard-assigned-provider badge', () => {
    render(<DoctorQueueCardBadges card={card({ hard_assigned_provider_name: 'Dr. Boateng' })} />);
    expect(screen.getByText(/Assigned: Dr. Boateng/)).toBeInTheDocument();
  });
});
