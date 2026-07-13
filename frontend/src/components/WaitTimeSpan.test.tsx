import { render, screen } from '@testing-library/react';
import { WaitTimeSpan } from './WaitTimeSpan';

const card = (wait_minutes: number, visit_date = '2099-01-01') => ({
  wait_minutes,
  wait_label: '',
  visit_date,
});

describe('WaitTimeSpan', () => {
  it('formats minutes under an hour', () => {
    render(<WaitTimeSpan card={card(45)} />);
    expect(screen.getByText('45m')).toBeInTheDocument();
  });

  it('formats hours and minutes', () => {
    render(<WaitTimeSpan card={card(90)} />);
    expect(screen.getByText('1h 30m')).toBeInTheDocument();
  });

  it('uses server-provided wait_label when available', () => {
    render(<WaitTimeSpan card={{ wait_minutes: 999, wait_label: '2h 5m', visit_date: '2099-01-01' }} />);
    expect(screen.getByText('2h 5m')).toBeInTheDocument();
  });

  it('appends suffix', () => {
    render(<WaitTimeSpan card={card(10)} suffix=" waiting" />);
    expect(screen.getByText('10m waiting')).toBeInTheDocument();
  });

  it('applies long severity for 4h+ wait', () => {
    const { container } = render(<WaitTimeSpan card={card(300)} />);
    expect(container.querySelector('[data-wait-severity="long"]')).toBeInTheDocument();
  });

  it('applies medium severity for 2h+ wait', () => {
    const { container } = render(<WaitTimeSpan card={card(150)} />);
    expect(container.querySelector('[data-wait-severity="medium"]')).toBeInTheDocument();
  });

  it('applies long severity for carry-over (past visit date)', () => {
    const { container } = render(<WaitTimeSpan card={card(5, '2000-01-01')} />);
    expect(container.querySelector('[data-wait-severity="long"]')).toBeInTheDocument();
  });

  it('renders plain text for short waits', () => {
    const { container } = render(<WaitTimeSpan card={card(30)} />);
    expect(container.querySelector('[data-wait-severity]')).not.toBeInTheDocument();
  });

  // SCALE-1.8 follow-up — client-computed wait from a stable start epoch.
  it('computes wait live from started_at_epoch (ignoring stale server value)', () => {
    const epoch = Math.floor(Date.now() / 1000) - 40 * 60; // started 40 min ago
    render(
      <WaitTimeSpan
        card={{ wait_minutes: 9999, wait_label: 'STALE', visit_date: '2099-01-01', started_at_epoch: epoch }}
      />,
    );
    expect(screen.getByText('40m')).toBeInTheDocument();
  });

  it('derives severity from the client-computed wait, not the server value', () => {
    const epoch = Math.floor(Date.now() / 1000) - 250 * 60; // 250 min → long severity
    const { container } = render(
      <WaitTimeSpan
        card={{ wait_minutes: 1, wait_label: '', visit_date: '2099-01-01', started_at_epoch: epoch }}
      />,
    );
    expect(container.querySelector('[data-wait-severity="long"]')).toBeInTheDocument();
  });
});
