import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLogCard } from './AuditLogCard';
import * as oeFetchModule from '@core/oeFetch';

vi.mock('@core/oeFetch');
const mockedFetch = vi.mocked(oeFetchModule.oeFetch);

const queryResult = {
  rows: [
    { id: 5, date: '2026-07-11 09:00:00', event: 'login', category: 'security', user: 'ama', patient_id: 0, success: true, comments: 'ok' },
    { id: 4, date: '2026-07-11 08:00:00', event: 'delete', category: 'patient', user: 'kojo', patient_id: 42, success: false, comments: 'denied' },
  ],
  total: 2,
  page: 1,
  page_size: 25,
};

describe('AuditLogCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetch.mockImplementation(async (action: string) => {
      if (action === 'admin.audit.query') return queryResult as never;
      if (action === 'admin.audit.detail') {
        return { ...queryResult.rows[1], user_notes: 'extra note' } as never;
      }
      if (action === 'admin.audit.export') return { filename: 'a.csv', content: 'x', row_count: 2 } as never;
      return {} as never;
    });
  });

  it('loads and renders log rows', async () => {
    render(<AuditLogCard ajaxUrl="/ajax.php" csrfToken="tok" />);
    expect(await screen.findByText('login')).toBeInTheDocument();
    expect(screen.getByText('2 entries · page 1 of 1')).toBeInTheDocument();
    expect(screen.getByText('Fail')).toBeInTheDocument();
  });

  it('applies filters on Search', async () => {
    render(<AuditLogCard ajaxUrl="/ajax.php" csrfToken="tok" />);
    await screen.findByText('login');

    fireEvent.change(screen.getByLabelText('User'), { target: { value: 'kojo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      const call = mockedFetch.mock.calls.filter((c) => c[0] === 'admin.audit.query').pop();
      expect((call?.[1] as { params: { user: string } }).params.user).toBe('kojo');
    });
  });

  it('opens a detail SlideOver with the full comments + notes', async () => {
    render(<AuditLogCard ajaxUrl="/ajax.php" csrfToken="tok" />);
    await screen.findByText('login');

    fireEvent.click(screen.getAllByRole('button', { name: 'View' })[1]);
    await waitFor(() => expect(screen.getByText('extra note')).toBeInTheDocument());
    expect(screen.getByText('Audit entry')).toBeInTheDocument();
  });
});
