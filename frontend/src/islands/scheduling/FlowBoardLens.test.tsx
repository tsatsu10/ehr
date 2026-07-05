import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { fetchFlowBoard, updateFlowBoardRoom } from './schedulingApi';
import { FlowBoardLens } from './FlowBoardLens';

vi.mock('./schedulingApi', () => ({
  fetchFlowBoard: vi.fn().mockResolvedValue({
    date: '2026-06-30',
    facility_id: 3,
    provider_id: null,
    poll_interval_ms: 20000,
    revision: 'test-revision',
    can_advance: true,
    queue_bridge_enabled: false,
    lanes: [{
      status: '@',
      label: 'Arrived',
      count: 1,
      cards: [{
        pc_eid: 42,
        pid: 3,
        pubpid: 'MRN003',
        patient_name: 'Ama Boateng',
        appt_time_label: '09:00',
        category_label: 'Office Visit',
        status: '@',
        status_label: 'Arrived',
        room: '',
        status_since: '2026-06-30T09:00:00+00:00',
        minutes_in_status: 12,
        alert_minutes: 30,
        alert_level: 'ok',
        is_recurring: false,
        has_tracker: true,
        next_status: null,
        check_in_status: '@',
        queue_bridge_ex01: false,
        queue_bridge_fix_url: null,
      }],
    }],
  }),
  advanceFlowBoardStatus: vi.fn(),
  updateFlowBoardRoom: vi.fn(),
  pollFlowBoard: vi.fn(),
  fetchFlowBoardPrefs: vi.fn().mockResolvedValue({ collapsed: [], order: [] }),
  saveFlowBoardPrefs: vi.fn().mockResolvedValue({ collapsed: [], order: [] }),
}));

const filters = { facilityId: 3, providerId: 0, date: '2026-06-30' };

describe('FlowBoardLens', () => {
  it('renders kanban lane with patient card', async () => {
    render(
      <FlowBoardLens
        ajaxUrl="/mock/ajax"
        csrfToken="token"
        filters={filters}
        refreshToken={0}
        frontDeskUrl="/front-desk"
        moduleUrl="/public"
        authUserId={1}
      />,
    );

    expect(await screen.findByLabelText('Ama Boateng, Arrived')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Arrived' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Room for Ama Boateng/)).toBeInTheDocument();
  });

  it('renders EX-01 queue bridge chip when card is flagged', async () => {
    vi.mocked(fetchFlowBoard).mockResolvedValueOnce({
      date: '2026-06-30',
      facility_id: 3,
      provider_id: null,
      poll_interval_ms: 20000,
      revision: 'ex01-revision',
      can_advance: true,
      queue_bridge_enabled: true,
      lanes: [{
        status: '@',
        label: 'Arrived',
        count: 1,
        cards: [{
          pc_eid: 9,
          pid: 1,
          pubpid: 'MRN001',
          patient_name: 'Ama Boateng',
          appt_time_label: '09:00',
          category_label: 'Office Visit',
          status: '@',
          status_label: 'Arrived',
          room: '',
          status_since: '2026-06-30T09:00:00+00:00',
          minutes_in_status: 12,
          alert_minutes: 30,
          alert_level: 'ok',
          is_recurring: false,
          has_tracker: true,
          next_status: null,
          check_in_status: '@',
          queue_bridge_ex01: true,
          queue_bridge_fix_url: '/queue-bridge/index.php',
        }],
      }],
    });

    render(
      <FlowBoardLens
        ajaxUrl="/mock/ajax"
        csrfToken="token"
        filters={filters}
        refreshToken={1}
        frontDeskUrl="/front-desk"
        moduleUrl="/public"
        authUserId={1}
      />,
    );

    expect(await screen.findByText('No clinical visit')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /fix/i })).toHaveAttribute(
      'href',
      '/queue-bridge/index.php',
    );
  });

  it('saves room on blur when value changes', async () => {
    vi.mocked(updateFlowBoardRoom).mockResolvedValue({
      date: '2026-06-30',
      facility_id: 3,
      provider_id: null,
      poll_interval_ms: 20000,
      can_advance: true,
      queue_bridge_enabled: false,
      lanes: [],
      revision: '',
    });

    render(
      <FlowBoardLens
        ajaxUrl="/mock/ajax"
        csrfToken="token"
        filters={filters}
        refreshToken={0}
        frontDeskUrl="/front-desk"
        moduleUrl="/public"
        authUserId={1}
      />,
    );

    const roomInput = await screen.findByLabelText(/Room for Ama Boateng/);
    fireEvent.change(roomInput, { target: { value: 'Rm 2' } });
    await waitFor(() => {
      expect(roomInput).toHaveValue('Rm 2');
    });
    fireEvent.blur(roomInput);

    await waitFor(
      () => {
        expect(updateFlowBoardRoom).toHaveBeenCalledWith(
          '/mock/ajax',
          'token',
          filters,
          42,
          'Rm 2',
        );
      },
      { timeout: 3000 },
    );
  });
});
