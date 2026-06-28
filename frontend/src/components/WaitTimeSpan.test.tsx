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

  it('applies long class for 4h+ wait', () => {
    const { container } = render(<WaitTimeSpan card={card(300)} />);
    expect(container.querySelector('.oe-nc-wait-long')).toBeInTheDocument();
  });

  it('applies medium class for 2h+ wait', () => {
    const { container } = render(<WaitTimeSpan card={card(150)} />);
    expect(container.querySelector('.oe-nc-wait-medium')).toBeInTheDocument();
  });

  it('applies long class for carry-over (past visit date)', () => {
    const { container } = render(<WaitTimeSpan card={card(5, '2000-01-01')} />);
    expect(container.querySelector('.oe-nc-wait-long')).toBeInTheDocument();
  });

  it('renders plain text for short waits', () => {
    const { container } = render(<WaitTimeSpan card={card(30)} />);
    expect(container.querySelector('.oe-nc-wait-long')).not.toBeInTheDocument();
    expect(container.querySelector('.oe-nc-wait-medium')).not.toBeInTheDocument();
  });
});
