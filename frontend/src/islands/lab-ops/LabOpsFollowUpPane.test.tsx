import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { LabOpsFollowUpPane } from './LabOpsFollowUpPane';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

const data = {
  window_days: 14,
  row_cap: 100,
  unresulted: [
    {
      order_id: 1,
      pid: 5,
      patient_name: 'Smith, Sam',
      pubpid: 'MRN5',
      date: '2026-07-10',
      priority: 'routine',
      detail: 'CBC',
      age_days: 5,
      age_bucket: '3_7',
      chart_url: '/chart?pid=5',
    },
  ],
  abnormal_no_followup: [
    {
      order_id: 2,
      pid: 6,
      patient_name: 'Jones, Amy',
      pubpid: 'MRN6',
      date: '2026-07-01',
      detail: 'Glucose',
      age_days: 14,
      age_bucket: '8_plus',
      chart_url: '/chart?pid=6',
    },
  ],
  generated_at: '',
};

describe('LabOpsFollowUpPane', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('loads and renders both lists', async () => {
    mockFetch.mockResolvedValue(data);

    render(<LabOpsFollowUpPane ajaxUrl="/mock/ajax" csrfToken="t" facilityId={3} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'lab_ops.followup',
      expect.objectContaining({ params: { facility_id: 3, window_days: 14 } }),
    );
    expect(await screen.findByText('Smith, Sam')).toBeInTheDocument();
    expect(screen.getByText('Jones, Amy')).toBeInTheDocument();
    expect(screen.getByText('Ordered, no result yet (1)')).toBeInTheDocument();
    expect(screen.getByText('Abnormal result, patient not back since (1)')).toBeInTheDocument();
  });

  it('reloads with the chosen window', async () => {
    mockFetch.mockResolvedValue(data);
    render(<LabOpsFollowUpPane ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText('Looking back'), { target: { value: '30' } });
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenLastCalledWith(
      'lab_ops.followup',
      expect.objectContaining({ params: { facility_id: 0, window_days: 30 } }),
    );
  });

  it('shows empty-state text when a list has no rows', async () => {
    mockFetch.mockResolvedValue({ ...data, unresulted: [], abnormal_no_followup: [] });
    render(<LabOpsFollowUpPane ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('Every order in this window has a result.')).toBeInTheDocument();
    expect(screen.getByText('No abnormal results are waiting on a return visit.')).toBeInTheDocument();
  });

  it('surfaces load errors', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));
    render(<LabOpsFollowUpPane ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('boom')).toBeInTheDocument();
  });
});
