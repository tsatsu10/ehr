import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FollowUpFlagModal } from './FollowUpFlagModal';
import * as oeFetchModule from '@core/oeFetch';
import * as deskToast from '@components/deskToast';

vi.mock('@core/oeFetch');
vi.mock('@components/deskToast');

const mockedFetch = vi.mocked(oeFetchModule.oeFetch);
const mockedToast = vi.mocked(deskToast.showDeskToast);

describe('FollowUpFlagModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderOpen(onClose = vi.fn()) {
    render(
      <FollowUpFlagModal
        open
        ajaxUrl="/ajax.php"
        csrfToken="tok"
        pid={42}
        onClose={onClose}
      />
    );
    return onClose;
  }

  it('posts flag_follow_up with pid and a default due date, then toasts and closes', async () => {
    mockedFetch.mockResolvedValue({ recall_id: 7, pid: 42, due_date: '2026-07-25', reason: 'Follow-up' });
    const onClose = renderOpen();

    fireEvent.change(screen.getByLabelText('Reason (optional)'), {
      target: { value: 'Recheck BP' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Flag for follow-up' }));

    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));
    const [action, opts] = mockedFetch.mock.calls[0];
    expect(action).toBe('scheduling.recalls.flag_follow_up');
    expect(opts).toMatchObject({
      method: 'POST',
      json: expect.objectContaining({ pid: 42, reason: 'Recheck BP' }),
    });
    // due_date defaults to a valid YYYY-MM-DD
    expect((opts as { json: { due_date: string } }).json.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await waitFor(() => expect(mockedToast).toHaveBeenCalledWith(expect.stringContaining('Recalls'), 'success'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error and stays open when the server rejects', async () => {
    mockedFetch.mockRejectedValue(new Error('Recall write permission denied'));
    const onClose = renderOpen();

    fireEvent.click(screen.getByRole('button', { name: 'Flag for follow-up' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Recall write permission denied')
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(mockedToast).not.toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    render(
      <FollowUpFlagModal open={false} ajaxUrl="/ajax.php" csrfToken="tok" pid={42} onClose={vi.fn()} />
    );
    expect(screen.queryByText('Flag for follow-up')).not.toBeInTheDocument();
  });
});
