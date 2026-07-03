import { fireEvent, render, screen } from '@testing-library/react';
import { AncillarySection } from './AncillarySection';
import type { AncillaryReportData } from './reportsTypes';

const baseData: AncillaryReportData = {
  enabled: true,
  start_date: '2026-07-01',
  end_date: '2026-07-02',
  refer_window_hours: 4,
  by_service_profile: { full_opd: 10, lab_direct: 3, pharmacy_walkin: 5 },
  pharmacy_outcomes: {
    otc_dispensed: 2,
    external_rx_dispensed: 1,
    rx_required_refer_to_opd: 1,
    rx_required_no_doctor_available: 0,
    rx_required_patient_declined: 0,
    unset: 1,
    other: 0,
  },
  lab_direct_without_referral: 1,
  pharmacy_to_opd_chains: 1,
  wrong_visit_type_cancels: 2,
};

describe('AncillarySection', () => {
  it('renders ancillary KPI sections', () => {
    render(
      <AncillarySection
        data={baseData}
        ajaxUrl="/ajax.php"
        startDate="2026-07-01"
        endDate="2026-07-02"
        onEndDateChange={() => {}}
      />,
    );

    expect(screen.getByText(/Visits by service profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Lab-direct without referral/i)).toBeInTheDocument();
    expect(screen.getByText(/Wrong visit type cancels/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Export CSV/i })).toHaveAttribute(
      'href',
      expect.stringContaining('reports.ancillary_export'),
    );
  });

  it('shows disabled message when ancillary off', () => {
    render(
      <AncillarySection
        data={{ enabled: false, start_date: '2026-07-01', end_date: '2026-07-01' }}
        ajaxUrl="/ajax.php"
        startDate="2026-07-01"
        endDate="2026-07-01"
        onEndDateChange={() => {}}
      />,
    );
    expect(screen.getByText(/Ancillary walk-in services are off/i)).toBeInTheDocument();
  });

  it('calls onEndDateChange when end date edited', () => {
    const onEndDateChange = vi.fn();
    render(
      <AncillarySection
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
