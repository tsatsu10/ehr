import { render, screen, fireEvent } from '@testing-library/react';
import { QueueCard } from './QueueCard';
import type { VisitCard } from '@core/types';

const baseCard: VisitCard = {
  id: 1,
  queue_number: '3',
  display_name: 'Jane Doe',
  pid: 10,
  pubpid: 'MRN001',
  state: 'waiting',
  sex: 'F',
  age_years: '34',
  wait_minutes: 15,
  wait_label: '15m',
  visit_date: '2099-06-27',
  visit_type_label: 'General OPD',
  chief_complaint: '',
  is_urgent: 0,
  skipped_triage: false,
  similar_surname_today: false,
  claim_lost: false,
};

describe('QueueCard', () => {
  it('renders queue number and patient name', () => {
    render(<QueueCard card={baseCard} />);
    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('shows the visit type in subtitle', () => {
    render(<QueueCard card={baseCard} />);
    expect(screen.getByText(/General OPD/)).toBeInTheDocument();
  });

  it('shows the FSM state pill', () => {
    render(<QueueCard card={baseCard} />);
    expect(screen.getByText('Waiting')).toBeInTheDocument();
  });

  it('masks name in privacy mode', () => {
    render(<QueueCard card={baseCard} privacyMode />);
    expect(screen.getByText('Jane D.')).toBeInTheDocument();
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
  });

  it('shows URGENT badge for urgent cards', () => {
    render(<QueueCard card={{ ...baseCard, is_urgent: 1 }} />);
    expect(screen.getByText('URGENT')).toBeInTheDocument();
  });

  it('shows chief complaint when present', () => {
    render(<QueueCard card={{ ...baseCard, chief_complaint: 'Headache' }} />);
    expect(screen.getByText(/CC: Headache/)).toBeInTheDocument();
  });

  it('calls onClick with the card when clicked', () => {
    const onClick = vi.fn();
    render(<QueueCard card={baseCard} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(baseCard);
  });

  it('is disabled when claim_lost', () => {
    render(<QueueCard card={{ ...baseCard, claim_lost: true }} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows similar-surname badge', () => {
    render(<QueueCard card={{ ...baseCard, similar_surname_today: true }} />);
    expect(screen.getByText('Same surname today')).toBeInTheDocument();
  });

  it('shows ancillary badges when present', () => {
    render(
      <QueueCard
        card={{
          ...baseCard,
          ancillary_badges: ['lab_direct', 'referral_on_file'],
        }}
      />,
    );
    expect(screen.getByText('Direct lab')).toBeInTheDocument();
    expect(screen.getByText('Referral on file')).toBeInTheDocument();
  });

  it('shows queue bridge badge when present', () => {
    render(
      <QueueCard
        card={{
          ...baseCard,
          queue_bridge_badge: {
            code: 'EX-03',
            label: 'Appt not linked',
            hub_url: '/queue-bridge/index.php',
          },
        }}
      />,
    );
    const badge = screen.getByText('Appt not linked');
    expect(badge).toBeInTheDocument();
    expect(badge.closest('a')).toHaveAttribute('href', '/queue-bridge/index.php');
  });
});
