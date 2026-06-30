import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { PatientContextBanner } from './PatientContextBanner';
import { PaginationBar } from './PaginationBar';
import { SegmentedControl } from './SegmentedControl';
import { StatCard } from './StatCard';

describe('PatientContextBanner', () => {
  const identity = {
    display_name: 'Jane Doe',
    sex: 'Female',
    age_years: '32',
    pubpid: 'MRN-42',
  };

  it('renders full layout with avatar and completion bar when below threshold', () => {
    render(
      <PatientContextBanner
        identity={identity}
        layout="full"
        completion={{ score: 55, billing_threshold: 70 }}
        aside={<span>Aside</span>}
      />
    );

    expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument();
    expect(screen.getByText(/MRN MRN-42/)).toBeInTheDocument();
    expect(screen.getByText('Aside')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Profile completion' })).toBeInTheDocument();
  });

  it('renders compact layout with inline identity and allergy chip', () => {
    render(
      <PatientContextBanner
        identity={identity}
        layout="compact"
        safety={{ allergies_severe: ['Penicillin'] }}
      />
    );

    expect(screen.getByText(/Jane Doe · Female 32 · MRN MRN-42/)).toBeInTheDocument();
    expect(screen.getByText('Penicillin')).toBeInTheDocument();
  });
});

describe('SegmentedControl', () => {
  it('fires onChange when segment clicked', () => {
    const onChange = vi.fn();

    render(
      <SegmentedControl
        ariaLabel="Filter"
        value="all"
        onChange={onChange}
        segments={[
          { id: 'all', label: 'All', count: 12 },
          { id: 'urgent', label: 'Urgent', count: 2 },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('tab', { name: /Urgent \(2\)/ }));
    expect(onChange).toHaveBeenCalledWith('urgent');
  });
});

describe('PaginationBar', () => {
  it('hides when total fits one page', () => {
    const { container } = render(
      <PaginationBar page={1} pageSize={20} total={10} onPageChange={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows range summary', () => {
    render(
      <PaginationBar page={2} pageSize={20} total={45} onPageChange={() => {}} />
    );
    expect(screen.getByText('Showing 21–40 of 45')).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('renders value and label', () => {
    render(<StatCard label="Started" value={8} />);
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Started')).toBeInTheDocument();
  });
});
