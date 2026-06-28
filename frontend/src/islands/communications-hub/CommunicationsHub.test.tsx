import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { CommunicationsHub } from './CommunicationsHub';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
  OeFetchError: class OeFetchError extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

const props = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'test-token',
  canViewAllUsers: false,
  initialLens: 'messages' as const,
  preferences: {
    lens: 'messages' as const,
    activity: '1',
    scope: 'my' as const,
    sort: { sortby: 'pnotes.date', sortorder: 'desc' as const },
  },
  reminderAddUrl: '/reminder-add',
  reminderLogUrl: '/reminder-log',
  legacyComposeUrl: '/compose',
  webroot: '/openemr',
};

describe('CommunicationsHub', () => {
  beforeEach(() => {
    mockFetch.mockImplementation((action: string) => {
      if (action === 'communications.hub_counts') {
        return Promise.resolve({ messages_active: 2, reminders_in_window: 1 });
      }
      if (action === 'communications.messages_list') {
        return Promise.resolve({
          rows: [{
            id: 1,
            patient_name: 'Jane Doe',
            type: 'Note',
            from_name: 'Dr Smith',
            date: '2026-06-27',
            date_display: 'Jun 27',
            status: 'Active',
            is_unread: true,
          }],
          total: 1,
        });
      }
      return Promise.resolve({ rows: [], total: 0 });
    });

    document.body.innerHTML =
      '<button id="nc-comm-lens-messages"></button>' +
      '<button id="nc-comm-lens-reminders"></button>' +
      '<span id="nc-comm-count-messages"></span>' +
      '<span id="nc-comm-count-reminders"></span>' +
      '<input id="nc-comm-search" />' +
      '<select id="nc-comm-activity"><option value="1">Active</option></select>' +
      '<button id="nc-comm-refresh"></button>' +
      '<a id="nc-comm-compose-link"></a>';
  });

  afterEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = '';
  });

  it('loads message list on mount', async () => {
    render(<CommunicationsHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith('communications.hub_counts', expect.any(Object));
    expect(mockFetch).toHaveBeenCalledWith('communications.messages_list', expect.any(Object));
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
  });

  it('shows empty detail prompt initially', async () => {
    render(<CommunicationsHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Select an item to read details/i)).toBeInTheDocument();
  });

  it('shows compose button on messages lens', async () => {
    render(<CommunicationsHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Compose' })).toBeInTheDocument();
  });

  it('supports keyboard list navigation (COM-F13)', async () => {
    mockFetch.mockImplementation((action: string) => {
      if (action === 'communications.hub_counts') {
        return Promise.resolve({ messages_active: 2, reminders_in_window: 0 });
      }
      if (action === 'communications.messages_list') {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              patient_name: 'Jane Doe',
              type: 'Note',
              from_name: 'Dr Smith',
              date: '2026-06-27',
              date_display: 'Jun 27',
              status: 'Active',
            },
            {
              id: 2,
              patient_name: 'John Roe',
              type: 'Note',
              from_name: 'Dr Jones',
              date: '2026-06-26',
              date_display: 'Jun 26',
              status: 'Active',
            },
          ],
          total: 2,
        });
      }
      if (action === 'communications.message_detail') {
        return Promise.resolve({ id: 2, body: 'Hello', can_mark_done: false });
      }
      return Promise.resolve({ rows: [], total: 0 });
    });

    render(<CommunicationsHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    const listbox = screen.getByRole('listbox', { name: 'Items' });
    listbox.focus();

    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('option', { name: /Jane Doe/i })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('option', { name: /John Roe/i })).toHaveAttribute('aria-selected', 'true');
    expect(mockFetch).toHaveBeenCalledWith('communications.message_detail', expect.any(Object));
  });
});
