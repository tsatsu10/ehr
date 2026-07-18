import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { FeesTab } from './FeesTab';
import type { FeeScheduleRow } from '../adminTypes';

const rows: FeeScheduleRow[] = [
  {
    id: 1,
    code: 'OPD_CONSULT',
    name: 'OPD consultation',
    category: 'consult',
    category_label: 'Consultation',
    price_amount: 50,
    code_type: 'CPT4',
    billing_code: 'OPD_CONSULT',
    sort_order: 10,
    is_active: true,
  },
  {
    id: 2,
    code: 'OLD_FEE',
    name: 'Retired fee line',
    category: 'other',
    price_amount: 5,
    code_type: 'CPT4',
    billing_code: 'OLD_FEE',
    sort_order: 20,
    is_active: false,
  },
];

const baseProps = {
  feeSchedule: rows,
  settings: { currency_symbol: '$', currency_decimals: 2, currency_symbol_position: 'before' as const },
  webroot: '/openemr',
  csv: '',
  importing: false,
  onCsvChange: vi.fn(),
  onAdd: vi.fn(),
  onEdit: vi.fn(),
  onArchive: vi.fn(),
  onImport: vi.fn(),
  onBulkPrice: vi.fn(),
};

describe('FeesTab', () => {
  it('shows both active and archived lines by default, with a row count', () => {
    render(<FeesTab {...baseProps} />);

    expect(screen.getByText('OPD consultation')).toBeInTheDocument();
    expect(screen.getByText('Retired fee line')).toBeInTheDocument();
    expect(screen.getByText('2 of 2 fee lines')).toBeInTheDocument();
  });

  it('filters by search text across code, name, and category', () => {
    render(<FeesTab {...baseProps} />);

    fireEvent.change(screen.getByLabelText('Search fee lines'), { target: { value: 'consult' } });

    expect(screen.getByText('OPD consultation')).toBeInTheDocument();
    expect(screen.queryByText('Retired fee line')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 2 fee lines')).toBeInTheDocument();
  });

  it('hides archived lines when "Show archived" is unchecked', () => {
    render(<FeesTab {...baseProps} />);

    fireEvent.click(screen.getByLabelText('Show archived'));

    expect(screen.getByText('OPD consultation')).toBeInTheDocument();
    expect(screen.queryByText('Retired fee line')).not.toBeInTheDocument();
  });

  it('shows a filtered empty state (not the no-data empty state) when a filter matches nothing', () => {
    render(<FeesTab {...baseProps} />);

    fireEvent.change(screen.getByLabelText('Search fee lines'), { target: { value: 'nonexistent' } });

    expect(screen.getByText('No fee lines match this filter')).toBeInTheDocument();
    expect(screen.queryByText('No fee lines configured')).not.toBeInTheDocument();
  });

  it('shows the no-data empty state when there are no fee lines at all', () => {
    render(<FeesTab {...baseProps} feeSchedule={[]} />);

    expect(screen.getByText('No fee lines configured')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search fee lines')).not.toBeInTheDocument();
  });
});
