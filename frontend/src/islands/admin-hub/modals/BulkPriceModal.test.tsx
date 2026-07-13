import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkPriceModal } from './BulkPriceModal';
import * as oeFetchModule from '@core/oeFetch';

vi.mock('@core/oeFetch');
const mockedFetch = vi.mocked(oeFetchModule.oeFetch);

const preview = {
  dry_run: true,
  changes: [
    {
      id: 1,
      code: 'OPD',
      name: 'OPD consultation',
      category_label: 'Consultation',
      old_price: 50,
      new_price: 55,
      scope_label: 'This facility',
    },
  ],
  change_count: 1,
  total_matched: 3,
};

describe('BulkPriceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetch.mockImplementation(async (_action: string, opts?: oeFetchModule.OeFetchOptions) => {
      const json = (opts?.json ?? {}) as { dry_run?: boolean };
      if (json.dry_run) return preview as never;
      return { fee_schedule: [{ id: 1 }], bulk_summary: { changed: 1 } } as never;
    });
  });

  const baseProps = {
    open: true,
    ajaxUrl: '/ajax.php',
    csrfToken: 'tok',
    facilityId: 0,
    categories: [{ value: 'consult', label: 'Consultation' }],
    settings: {},
    onClose: vi.fn(),
    onApplied: vi.fn(),
    onRefreshSchedule: vi.fn(),
  };

  it('previews the diff, then applies only after preview', async () => {
    const onApplied = vi.fn();
    const onRefreshSchedule = vi.fn();
    const onClose = vi.fn();
    render(
      <BulkPriceModal
        {...baseProps}
        onApplied={onApplied}
        onRefreshSchedule={onRefreshSchedule}
        onClose={onClose}
      />,
    );

    // Apply is disabled until a preview exists.
    expect(screen.getByRole('button', { name: /Preview first/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Preview changes/i }));
    expect(await screen.findByText('OPD')).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 fee lines will change/i)).toBeInTheDocument();

    const applyBtn = screen.getByRole('button', { name: /Apply to 1 fee/i });
    expect(applyBtn).toBeEnabled();
    fireEvent.click(applyBtn);

    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(1));
    expect(onRefreshSchedule).toHaveBeenCalledWith([{ id: 1 }]);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a no-change notice when nothing differs', async () => {
    mockedFetch.mockResolvedValueOnce({ dry_run: true, changes: [], change_count: 0, total_matched: 4 } as never);
    render(<BulkPriceModal {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Preview changes/i }));
    expect(await screen.findByText(/No active fee lines would change/i)).toBeInTheDocument();
    // Apply stays disabled with zero changes.
    expect(screen.getByRole('button', { name: /Preview first/i })).toBeDisabled();
  });
});
