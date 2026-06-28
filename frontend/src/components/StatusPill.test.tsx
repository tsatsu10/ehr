import { render, screen } from '@testing-library/react';
import { StatusPill } from './StatusPill';

describe('StatusPill', () => {
  it('renders the correct label for a known state', () => {
    render(<StatusPill state="waiting" />);
    expect(screen.getByText('Waiting')).toBeInTheDocument();
  });

  it('prepends queue number when provided', () => {
    render(<StatusPill state="with_doctor" queueNumber="7" />);
    expect(screen.getByText('#7 With doctor')).toBeInTheDocument();
  });

  it('applies the correct variant class', () => {
    const { container } = render(<StatusPill state="ready_for_doctor" />);
    expect(container.firstChild).toHaveClass('oe-nc-status-pill--warning');
  });

  it('renders the dot element', () => {
    const { container } = render(<StatusPill state="completed" />);
    const dot = container.querySelector('.oe-nc-status-pill__dot');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute('aria-hidden', 'true');
  });

  it('falls back gracefully for unknown state', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing unknown value
    render(<StatusPill state={'unknown_state' as any} />);
    expect(screen.getByText('unknown_state')).toBeInTheDocument();
  });
});
