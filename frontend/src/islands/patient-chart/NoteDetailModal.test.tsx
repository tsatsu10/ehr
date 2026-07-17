import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { MessagesTab } from './MessagesTab';
import type { ChartMessagesData } from './patientChartTypes';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

function makeData(over: Partial<ChartMessagesData> = {}): ChartMessagesData {
  return {
    messages: [
      {
        id: 9,
        title: 'Lab follow-up',
        preview: 'Patient called…',
        author: 'nurse1',
        date: '14/07/2026',
        active: true,
        detail_url: undefined,
      },
    ],
    reminders: [],
    message_total: 1,
    has_more: false,
    editor_urls: {},
    native_notes: true,
    activity: 'all',
    ...over,
  };
}

const baseProps = {
  loading: false,
  loadingMore: false,
  error: null,
  onLoadMore: () => {},
  ajaxUrl: '/mock/ajax',
  csrfToken: 't',
  pid: 5,
  activity: 'all',
  onActivityChange: () => {},
};

describe('MessagesTab native notes (CP-5)', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('opens the native note detail modal from a row', async () => {
    mockFetch.mockResolvedValueOnce({
      id: 9,
      title: 'Lab follow-up',
      author: 'nurse1',
      assigned_to: 'doc1',
      date: '14/07/2026',
      status: 'New',
      active: true,
      thread_html: '<div class="msg-thread">Patient called about results.</div>',
    });

    render(<MessagesTab data={makeData()} {...baseProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Lab follow-up' }));
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'patients.note_detail',
      expect.objectContaining({ params: { pid: 5, note_id: 9 } }),
    );
    expect(await screen.findByText('Patient called about results.')).toBeInTheDocument();
  });

  it('shows the activity filter and reports changes', () => {
    const onActivityChange = vi.fn();
    render(<MessagesTab data={makeData()} {...baseProps} onActivityChange={onActivityChange} />);

    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'inactive' } });

    expect(onActivityChange).toHaveBeenCalledWith('inactive');
  });

  it('keeps the stock link path when the flag is off', () => {
    render(
      <MessagesTab
        data={makeData({
          native_notes: false,
          messages: [{ id: 9, title: 'Old note', detail_url: '/pnotes?noteid=9', active: true }],
          editor_urls: { pnotes: '/pnotes' },
        })}
        {...baseProps}
      />,
    );

    // Stock jump link + stock "All notes" button, no filter.
    expect(screen.getByRole('link', { name: 'Old note' })).toHaveAttribute('href', '/pnotes?noteid=9');
    expect(screen.getByRole('link', { name: 'All notes' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Show')).not.toBeInTheDocument();
  });
});
