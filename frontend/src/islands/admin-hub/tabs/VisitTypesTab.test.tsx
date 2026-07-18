import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { VisitTypesTab } from './VisitTypesTab';
import type { VisitTypeRow } from '../adminTypes';

const rows: VisitTypeRow[] = [
  {
    id: 1,
    label: 'OPD consult',
    service_profile: 'full_opd',
    referral_required: false,
    is_default: true,
    is_active: true,
  },
  {
    id: 2,
    label: 'Retired visit type',
    service_profile: 'lab_direct',
    referral_required: false,
    is_default: false,
    is_active: false,
  },
];

const baseProps = {
  visitTypes: rows,
  onAdd: vi.fn(),
  onEdit: vi.fn(),
  onArchive: vi.fn(),
};

describe('VisitTypesTab', () => {
  it('shows both active and archived visit types by default, with a row count', () => {
    render(<VisitTypesTab {...baseProps} />);

    expect(screen.getByText('OPD consult')).toBeInTheDocument();
    expect(screen.getByText('Retired visit type')).toBeInTheDocument();
    expect(screen.getByText('2 of 2 visit types')).toBeInTheDocument();
  });

  it('filters by search text', () => {
    render(<VisitTypesTab {...baseProps} />);

    fireEvent.change(screen.getByLabelText('Search visit types'), { target: { value: 'OPD' } });

    expect(screen.getByText('OPD consult')).toBeInTheDocument();
    expect(screen.queryByText('Retired visit type')).not.toBeInTheDocument();
  });

  it('hides archived visit types when "Show archived" is unchecked', () => {
    render(<VisitTypesTab {...baseProps} />);

    fireEvent.click(screen.getByLabelText('Show archived'));

    expect(screen.getByText('OPD consult')).toBeInTheDocument();
    expect(screen.queryByText('Retired visit type')).not.toBeInTheDocument();
  });

  it('shows the no-data empty state when there are no visit types at all', () => {
    render(<VisitTypesTab {...baseProps} visitTypes={[]} />);

    expect(screen.getByText('No visit types configured')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search visit types')).not.toBeInTheDocument();
  });
});
