import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { VisitDetailModal } from './VisitDetailModal';
import type { VisitDetailData } from '@core/types';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
}));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

const detailData: VisitDetailData = {
  visit: {
    id: 42,
    pid: 5,
    queue_number: '1',
    state: 'waiting',
    row_version: 1,
    chief_complaint: 'Persistent cough',
  },
  preview: {
    identity: {
      pid: 5,
      display_name: 'Kwame Mensah',
      sex: 'M',
      age_years: '28',
      pubpid: 'MRN999',
    },
    completion: {
      score: 80,
      billing_threshold: 70,
      chart_url: '/chart/5',
    },
  },
  visit_summary: {
    state: 'waiting',
    state_label: 'Waiting',
    queue_number: 1,
    visit_type_label: 'General OPD',
    wait_minutes: 10,
    wait_label: '10m',
    visit_date: '2099-06-27',
    provider_hint: 'Unassigned',
  },
  audit_timeline: [],
};

const baseProps = {
  visitId: 42,
  open: true,
  ajaxUrl: '/mock/ajax',
  csrfToken: 'token',
  facilityId: 1,
  canCancel: true,
  deskUrls: { front_desk: '/front-desk' },
  onClose: vi.fn(),
  onOpenDrawer: vi.fn(),
  onVisitCancelled: vi.fn(),
};

describe('VisitDetailModal', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue(detailData);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('loads visit detail and renders patient banner', async () => {
    render(<VisitDetailModal {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Kwame Mensah/)).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'visit.detail',
      expect.objectContaining({ json: { visit_id: 42 } }),
    );
    expect(screen.getByRole('link', { name: /Open Front Desk/i })).toHaveAttribute(
      'href',
      '/front-desk',
    );
    expect(screen.getByText(/Reason for visit:/i)).toBeInTheDocument();
    expect(screen.getByText('Persistent cough')).toBeInTheDocument();
    expect(document.getElementById('nc-visit-modal-banner')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<VisitDetailModal {...baseProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(container.querySelector('#nc-visit-modal-body')).not.toBeInTheDocument();
  });
});
