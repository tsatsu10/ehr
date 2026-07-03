import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ChartInChartSearch } from './ChartInChartSearch';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
}));

import { oeFetch } from '@core/oeFetch';

const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

describe('ChartInChartSearch', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      query: 'statin',
      items: [
        {
          category: 'Medications',
          title: 'Atorvastatin',
          detail: '10 mg',
          tab: 'clinical',
          anchor: 'clinical-meds',
        },
      ],
      truncated: false,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('searches and navigates to a clinical anchor', async () => {
    const onNavigate = vi.fn();

    render(
      <ChartInChartSearch
        ajaxUrl="/mock/ajax"
        csrfToken="token"
        pid={42}
        onNavigate={onNavigate}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Search this chart/i), {
      target: { value: 'statin' },
    });

    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith(
          'patients.chart.search',
          expect.objectContaining({
            params: { pid: 42, q: 'statin' },
          })
        );
      },
      { timeout: 1000 }
    );

    const result = await screen.findByRole('button', { name: /Atorvastatin/i });
    fireEvent.click(result);

    expect(onNavigate).toHaveBeenCalledWith('clinical', 'clinical-meds');
  });
});
