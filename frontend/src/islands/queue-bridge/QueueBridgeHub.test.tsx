import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ACTION_LABELS, LENS_LABELS } from './queueBridgeTypes';

vi.mock('./queueBridgeApi', () => ({
  fetchQueueBridgeList: vi.fn().mockResolvedValue({
    lens: 'action',
    snapshot_date: '2026-06-29',
    counts: { action: 1, info: 0, resolved: 0 },
    rows: [
      {
        exception_code: 'EX-01',
        severity: 'action',
        pid: 12,
        pc_eid: 99,
        visit_id: null,
        patient_name: 'Kwame Owusu',
        appt_time_label: '09:00',
        summary: 'Arrived on schedule — no clinical visit',
        available_actions: ['start_visit_checkin', 'open_flow_board'],
        can_dismiss: false,
      },
    ],
    page: 1,
    has_more: false,
    can_resolve: true,
    can_dismiss: false,
    links: {
      visit_board_url: '/visit-board.php',
      front_desk_url: '/front-desk.php',
      flow_board_url: '/flow',
      scheduling_url: '/calendar',
      reports_url: '/reports.php',
    },
    eod_block_enabled: false,
  }),
  resolveQueueBridgeException: vi.fn(),
  dismissQueueBridgeException: vi.fn(),
}));

import { QueueBridgeHub } from './QueueBridgeHub';

const baseProps = {
  ajaxUrl: '/ajax.php',
  csrfToken: 'token',
  moduleUrl: '/module',
  visitBoardUrl: '/visit-board.php',
  frontDeskUrl: '/front-desk.php',
  flowBoardUrl: '/flow',
  schedulingUrl: '/calendar',
  reportsUrl: '/reports.php',
  facilityId: 1,
  initialLens: 'action' as const,
  canResolve: true,
  canDismiss: false,
  webroot: '/openemr',
};

describe('queue bridge labels', () => {
  it('exposes lens and action copy', () => {
    expect(LENS_LABELS.action).toBe('Exceptions');
    expect(ACTION_LABELS.start_visit_checkin).toBe('Start visit & check in');
  });
});

describe('QueueBridgeHub', () => {
  it('renders exception row with resolve action', async () => {
    render(<QueueBridgeHub {...baseProps} />);

    expect(await screen.findByText('Kwame Owusu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start visit & check in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Flow Board' })).toBeInTheDocument();
  });

  it('switches lenses via segmented control', async () => {
    render(<QueueBridgeHub {...baseProps} />);

    await screen.findByText('Kwame Owusu');
    fireEvent.click(screen.getByRole('tab', { name: /Recurring info/ }));
    expect(screen.getByRole('tab', { name: /Recurring info/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows dismiss action for EX-05 when row allows it', async () => {
    const { fetchQueueBridgeList } = await import('./queueBridgeApi');
    vi.mocked(fetchQueueBridgeList).mockResolvedValueOnce({
      lens: 'action',
      snapshot_date: '2026-06-29',
      counts: { action: 1, info: 0, resolved: 0 },
      rows: [
        {
          exception_code: 'EX-05',
          severity: 'action',
          pid: 12,
          pc_eid: 99,
          visit_id: 44,
          patient_name: 'Ama Boateng',
          appt_time_label: '10:00',
          summary: 'Appointment cancelled on schedule — visit still active',
          available_actions: ['cancel_visit', 'unlink_appointment', 'open_visit_board', 'dismiss'],
          can_dismiss: true,
        },
      ],
      page: 1,
      has_more: false,
      can_resolve: true,
      can_dismiss: true,
      links: {
        visit_board_url: '/visit-board.php',
        front_desk_url: '/front-desk.php',
        flow_board_url: '/flow',
        scheduling_url: '/calendar',
        reports_url: '/reports.php',
      },
      eod_block_enabled: false,
    });

    render(<QueueBridgeHub {...baseProps} canDismiss />);

    expect(await screen.findByText('Ama Boateng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });
});
