import { render, screen } from '@testing-library/react';
import { SchedulingSection } from './SchedulingSection';
import type { SchedulingReportData } from './reportsTypes';

const baseData: SchedulingReportData = {
  enabled: true,
  visit_date: '2026-06-30',
  booked_today: 12,
  booked_week: 48,
  week_range: { start: '2026-06-30', end: '2026-07-06' },
  arrival_funnel: { booked: 12, arrived: 8, no_show: 1 },
  walk_in_vs_scheduled: { scheduled: 7, walk_in: 5, scheduled_pct: 58.3 },
  recall_funnel: { due: 3, booked: 2, completed: 1, overdue: 4 },
  orthogonality_note: 'Scheduling counts appointments; Visits tab counts clinical queue — do not add them together.',
  full_analytics: {
    enabled: true,
    on_time_window_minutes: 15,
    check_in_latency: {
      sample_count: 4,
      median_minutes: 8,
      p90_minutes: 20,
      average_minutes: 9.5,
      on_time_count: 3,
      on_time_pct: 75,
      early_count: 1,
      late_count: 1,
    },
    provider_utilization: {
      provider_count: 1,
      providers: [
        {
          provider_id: 7,
          provider_name: 'Dr. Ada',
          booked: 10,
          arrived: 8,
          visits_started: 8,
          arrival_pct: 80,
          visit_start_pct: 100,
        },
      ],
    },
  },
};

describe('SchedulingSection', () => {
  it('renders scheduling KPI cards', () => {
    render(<SchedulingSection data={baseData} visitDate="2026-06-30" />);
    expect(screen.getByText(/Booked today/i)).toBeInTheDocument();
    expect(screen.getByText(/Booked this week/i)).toBeInTheDocument();
    expect(screen.getByText(/Overdue recalls/i)).toBeInTheDocument();
    expect(screen.getByText(/do not add them together/i)).toBeInTheDocument();
  });

  it('shows disabled message when scheduling integration off', () => {
    render(
      <SchedulingSection
        data={{ enabled: false, visit_date: '2026-06-30' }}
        visitDate="2026-06-30"
      />,
    );
    expect(screen.getByText(/Scheduling integration is off/i)).toBeInTheDocument();
  });

  it('renders full analytics when enabled', () => {
    render(<SchedulingSection data={baseData} visitDate="2026-06-30" />);
    expect(screen.getByText(/Slot to check-in latency/i)).toBeInTheDocument();
    expect(screen.getByText(/Median latency/i)).toBeInTheDocument();
    expect(screen.getByText(/Provider utilization/i)).toBeInTheDocument();
    expect(screen.getByText('Dr. Ada')).toBeInTheDocument();
  });
});
