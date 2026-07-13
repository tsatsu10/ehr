import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PerfPanelCard } from './PerfPanelCard';
import { oeFetch } from '@core/oeFetch';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
}));

const mockedFetch = vi.mocked(oeFetch);

const SUMMARY = {
  day: '2026-07-12',
  totals: { calls: 1234, errors: 3 },
  slowest: [
    { action: 'visit.board', calls: 800, errors: 0, avg_ms: 120, p95_ms: 500, max_ms: 2100 },
    { action: 'patients.search', calls: 200, errors: 3, avg_ms: 340, p95_ms: 1000, max_ms: 4200 },
  ],
  errors: [
    { action: 'patients.search', calls: 200, errors: 3, avg_ms: 340, p95_ms: 1000, max_ms: 4200 },
  ],
};

describe('PerfPanelCard', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('loads and renders the slowest actions and totals', async () => {
    mockedFetch.mockResolvedValue(SUMMARY);

    render(<PerfPanelCard ajaxUrl="/ajax.php" csrfToken="tok" />);

    expect(await screen.findByText('visit.board')).toBeInTheDocument();
    expect(screen.getByText(/1234 requests · 3 errors/)).toBeInTheDocument();
    expect(screen.getByText('Slowest actions (by p95)')).toBeInTheDocument();
    expect(screen.getByText('Actions with errors')).toBeInTheDocument();
    // Latency formatting: sub-second in ms, seconds with one decimal.
    expect(screen.getAllByText('500 ms').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2.1 s').length).toBeGreaterThan(0);
    // Day tokens (not client-computed dates) — the server clock decides.
    expect(mockedFetch).toHaveBeenCalledWith(
      'admin.perf.summary',
      expect.objectContaining({ params: { day: 'yesterday' } }),
    );
  });

  it('refetches for today when the day toggle changes', async () => {
    mockedFetch.mockResolvedValue({ ...SUMMARY, slowest: [], errors: [], totals: { calls: 0, errors: 0 } });

    render(<PerfPanelCard ajaxUrl="/ajax.php" csrfToken="tok" />);
    await screen.findByText(/Nothing recorded for this day yet/);

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(2));
    expect((mockedFetch.mock.calls[0]?.[1] as { params: { day: string } }).params.day).toBe('yesterday');
    expect((mockedFetch.mock.calls[1]?.[1] as { params: { day: string } }).params.day).toBe('today');
  });

  it('shows an error callout when the fetch fails', async () => {
    mockedFetch.mockRejectedValue(new Error('nope'));

    render(<PerfPanelCard ajaxUrl="/ajax.php" csrfToken="tok" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('nope');
  });

  it('renders the empty state without crashing when the payload is missing fields', async () => {
    // The host island's generic oeFetch mock resolves undefined — the card
    // must null-guard every nested field (see memory: self-fetching cards).
    mockedFetch.mockResolvedValue(undefined as never);

    render(<PerfPanelCard ajaxUrl="/ajax.php" csrfToken="tok" />);

    expect(await screen.findByText(/Nothing recorded for this day yet/)).toBeInTheDocument();
  });
});
