import { fireEvent, render, screen } from '@testing-library/react';
import { DocumentationIntegritySection } from './DocumentationIntegritySection';
import type { DocumentationIntegrityReportData } from './reportsTypes';

const baseData: DocumentationIntegrityReportData = {
  enabled: true,
  start_date: '2026-07-01',
  end_date: '2026-07-02',
  summary: {
    visits_with_events: 1,
    esign_events: 2,
    amendment_events: 1,
    reopen_events: 1,
    override_events: 1,
  },
  rows: [
    {
      visit_id: 42,
      visit_date: '2026-07-01',
      queue_number: 7,
      pubpid: 'P001',
      display_name: 'Jane Doe',
      encounter_id: 100,
      encounter_url: '/encounter/100',
      esign_events: [
        {
          datetime: '2026-07-01 10:00:00',
          signer_name: 'Dr Smith',
          event_type: 'lock',
          is_lock: 1,
          amendment: null,
          table: 'form_encounter',
        },
        {
          datetime: '2026-07-01 11:00:00',
          signer_name: 'Dr Smith',
          event_type: 'amendment',
          is_lock: 1,
          amendment: 'Corrected diagnosis',
          table: 'form_encounter',
        },
      ],
      reopened_events: [
        {
          datetime: '2026-07-01 12:00:00',
          actor_name: 'Lead Nurse',
          from_state: 'ready_for_payment',
          to_state: 'with_doctor',
          reason: 'Add order',
        },
      ],
      esign_override_events: [
        {
          datetime: '2026-07-01 13:00:00',
          actor_name: 'Cashier Lead',
          reason: 'Patient leaving — manager approved',
          encounter_id: 100,
        },
      ],
    },
  ],
};

describe('DocumentationIntegritySection', () => {
  it('renders integrity summary and visit rows', () => {
    render(
      <DocumentationIntegritySection
        data={baseData}
        ajaxUrl="/ajax.php"
        startDate="2026-07-01"
        endDate="2026-07-02"
        onEndDateChange={() => {}}
      />,
    );

    expect(screen.getByText(/Integrity summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/i)).toBeInTheDocument();
    expect(screen.getByText(/Corrected diagnosis/i)).toBeInTheDocument();
    expect(screen.getByText(/Patient leaving — manager approved/i)).toBeInTheDocument();
    expect(screen.getByText(/distinct from signature amendment notes/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Export CSV/i })).toHaveAttribute(
      'href',
      expect.stringContaining('reports.documentation_integrity_export'),
    );
  });

  it('shows empty state when no rows', () => {
    render(
      <DocumentationIntegritySection
        data={{
          enabled: true,
          start_date: '2026-07-01',
          end_date: '2026-07-01',
          summary: {
            visits_with_events: 0,
            esign_events: 0,
            amendment_events: 0,
            reopen_events: 0,
            override_events: 0,
          },
          rows: [],
        }}
        ajaxUrl="/ajax.php"
        startDate="2026-07-01"
        endDate="2026-07-01"
        onEndDateChange={() => {}}
      />,
    );
    expect(screen.getByText(/No documentation integrity events/i)).toBeInTheDocument();
  });

  it('calls onEndDateChange when end date edited', () => {
    const onEndDateChange = vi.fn();
    render(
      <DocumentationIntegritySection
        data={baseData}
        ajaxUrl="/ajax.php"
        startDate="2026-07-01"
        endDate="2026-07-02"
        onEndDateChange={onEndDateChange}
      />,
    );

    fireEvent.change(screen.getByLabelText(/End date/i), { target: { value: '2026-07-05' } });
    expect(onEndDateChange).toHaveBeenCalledWith('2026-07-05');
  });
});
