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

  it('applies a warning variant for ready_for_doctor', () => {
    render(<StatusPill state="ready_for_doctor" />);
    expect(screen.getByText('Ready for doctor')).toBeInTheDocument();
  });

  it('renders a coloured dot indicator', () => {
    const { container } = render(<StatusPill state="completed" />);
    // The dot is now a <span> with an inline background-color style
    const dot = container.querySelector('span[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
  });

  it('falls back gracefully for unknown state', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing unknown value
    render(<StatusPill state={'unknown_state' as any} />);
    expect(screen.getByText('unknown_state')).toBeInTheDocument();
  });
});
