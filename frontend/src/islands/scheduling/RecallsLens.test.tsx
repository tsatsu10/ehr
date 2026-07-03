import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { RecallsLens } from './RecallsLens';

vi.mock('./schedulingApi', () => ({
  fetchRecallsWorklist: vi.fn().mockResolvedValue({
    bucket: 'due',
    facility_id: 3,
    provider_id: null,
    today: '2026-06-30',
    counts: { overdue: 1, due: 1, upcoming: 0, completed: 0 },
    can_manage: true,
    providers: [{ id: 10, label: 'Smith, Jane' }],
    rows: [{
      recall_id: 7,
      pid: 3,
      pubpid: 'MRN003',
      patient_name: 'Ama Boateng',
      due_date: '2026-06-30',
      days_delta: 0,
      bucket: 'due',
      reason: '6-month review',
      provider_id: 10,
      facility_id: 3,
      status: 'open',
      status_label: 'Open',
      produced_eid: null,
      produced_event_date: '',
      outcome_note: '',
      contact: 'SMS ok',
    }],
  }),
  fetchCalendarDay: vi.fn(),
  deleteRecall: vi.fn(),
  updateRecallStatus: vi.fn(),
  saveRecall: vi.fn(),
  bookCalendarAppointment: vi.fn(),
}));

const filters = { facilityId: 3, providerId: 0, date: '2026-06-30' };

describe('RecallsLens', () => {
  it('renders worklist row', async () => {
    render(
      <RecallsLens
        ajaxUrl="/mock/ajax"
        csrfToken="token"
        filters={filters}
        facilities={[{ id: 3, label: 'Main Clinic' }]}
        refreshToken={0}
        newRecallSignal={0}
        frontDeskUrl="/front-desk"
        moduleUrl="/openemr/interface/modules/custom_modules/oe-module-new-clinic/public"
      />,
    );

    expect(await screen.findByText(/Ama Boateng/)).toBeInTheDocument();
    expect(screen.getByText(/6-month review/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Due now/i })).toBeInTheDocument();
  });
});
