import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { PharmOpsTransactionsReport } from './PharmOpsTransactionsReport';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

function page(items: unknown[], hasMore = false) {
  return { from: '2026-06-15', to: '2026-07-15', type: '', offset: 0, has_more: hasMore, generated_at: '', items };
}

describe('PharmOpsTransactionsReport', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders ledger rows and pages with Load more', async () => {
    mockFetch
      .mockResolvedValueOnce(
        page(
          [
            {
              sale_id: 1,
              date: '2026-07-01',
              type: 'sale',
              type_label: 'Sale',
              drug_name: 'Amoxicillin',
              lot_number: 'LOT-1',
              warehouse: '',
              who: 'Owusu, Ama',
              quantity: -5,
              amount: 12.5,
              billed: true,
              notes: '',
            },
          ],
          true,
        ),
      )
      .mockResolvedValueOnce(
        page(
          [
            {
              sale_id: 2,
              date: '2026-06-20',
              type: 'purchase',
              type_label: 'Purchase',
              drug_name: 'Amoxicillin',
              lot_number: 'LOT-2',
              warehouse: '',
              who: '',
              quantity: 100,
              amount: 0,
              billed: false,
              notes: 'Restock',
            },
          ],
          false,
        ),
      );

    render(<PharmOpsTransactionsReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('Owusu, Ama')).toBeInTheDocument();
    expect(screen.getByText('-5')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Load more/i }));
    });

    expect(await screen.findByText('Restock')).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    mockFetch.mockResolvedValue(page([]));

    render(<PharmOpsTransactionsReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('No transactions')).toBeInTheDocument();
  });
});
