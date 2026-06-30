import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { PharmOpsReportsPane } from './PharmOpsReportsPane';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
}));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

const props = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'token',
};

describe('PharmOpsReportsPane', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      default_report_id: 'reorder',
      reports: [
        {
          id: 'reorder',
          label: 'Reorder / low stock',
          description: 'Items at or below reorder point.',
          embed_url: '/openemr/interface/reports/inventory_list.php',
        },
        {
          id: 'activity',
          label: 'Inventory activity',
          description: 'Summary of stock movements.',
          embed_url: '/openemr/interface/reports/inventory_activity.php',
        },
      ],
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('loads catalog and renders iframe for default report', async () => {
    render(<PharmOpsReportsPane {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith('pharm_ops.reports_embed', expect.any(Object));
    expect(screen.getByLabelText('Report')).toBeInTheDocument();
    const frame = screen.getByTitle('Reorder / low stock');
    expect(frame).toHaveAttribute('src', '/openemr/interface/reports/inventory_list.php');
  });
});
