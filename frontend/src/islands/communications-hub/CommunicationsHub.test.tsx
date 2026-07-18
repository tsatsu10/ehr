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
      '<select id="nc-comm-activity"><option value="1">Open</option></select>' +
      '<select id="nc-comm-sort"><option value="date_desc">Newest first</option><option value="date_asc">Oldest first</option></select>' +
      '<button id="nc-comm-refresh"></button>' +
      // Lens-scoped toolbar actions (React toggles nc-hidden by lens).
      '<button id="nc-comm-view-log" class="nc-hidden">View log</button>' +
      '<button id="nc-comm-new-message">+ New message</button>' +
      '<button id="nc-comm-new-reminder" class="nc-hidden">+ New reminder</button>';
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

  it('surfaces a notice when a search only scanned the recent window', async () => {
    mockFetch.mockImplementation((action: string) => {
      if (action === 'communications.hub_counts') {
        return Promise.resolve({ messages_active: 0, reminders_in_window: 0 });
      }
      if (action === 'communications.messages_list') {
        return Promise.resolve({ rows: [], total: 0, search_truncated: true, search_scan_max: 5000 });
      }
      return Promise.resolve({ rows: [], total: 0 });
    });

    render(<CommunicationsHub {...props} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText(/most recent messages only/i)).toBeInTheDocument();
  });

  it('shows empty detail prompt initially', async () => {
    render(<CommunicationsHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Select an item to read details/i)).toBeInTheDocument();
  });

  it('opens compose from the toolbar "+ New message" action on the messages lens', async () => {
    render(<CommunicationsHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    // The action lives in the Twig toolbar (top-right, like every other desk);
    // the island binds it by id rather than rendering its own footer button.
    const newMessage = document.getElementById('nc-comm-new-message') as HTMLButtonElement;
    expect(newMessage).not.toBeNull();
    expect(newMessage.classList.contains('nc-hidden')).toBe(false);

    // Idle prompt is showing before…
    expect(screen.getByText(/Select an item to read details/i)).toBeInTheDocument();

    await act(async () => {
      newMessage.click();
    });

    // …and compose has taken over the detail pane after.
    expect(screen.queryByText(/Select an item to read details/i)).not.toBeInTheDocument();
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

  it('swaps the toolbar primary action per lens (+ New reminder / View log on reminders)', async () => {
    render(<CommunicationsHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    const newMessage = document.getElementById('nc-comm-new-message') as HTMLButtonElement;
    const newReminder = document.getElementById('nc-comm-new-reminder') as HTMLButtonElement;
    const viewLog = document.getElementById('nc-comm-view-log') as HTMLButtonElement;

    expect(newMessage.classList.contains('nc-hidden')).toBe(false);
    expect(newReminder.classList.contains('nc-hidden')).toBe(true);
    expect(viewLog.classList.contains('nc-hidden')).toBe(true);

    await act(async () => {
      (document.getElementById('nc-comm-lens-reminders') as HTMLButtonElement).click();
    });

    expect(newMessage.classList.contains('nc-hidden')).toBe(true);
    expect(newReminder.classList.contains('nc-hidden')).toBe(false);
    expect(viewLog.classList.contains('nc-hidden')).toBe(false);
  });

  it('filters reminders client-side by the toolbar search', async () => {
    mockFetch.mockImplementation((action: string) => {
      if (action === 'communications.hub_counts') {
        return Promise.resolve({ messages_active: 0, reminders_in_window: 2 });
      }
      if (action === 'communications.reminders_list') {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              pid: 10,
              patient_name: 'Jane Doe',
              from_name: 'Dr Smith',
              due_date: '2026-07-18',
              due_display: '18/07/2026',
              urgency: 'upcoming',
              urgency_label: 'Upcoming',
              preview: 'Check labs',
            },
            {
              id: 2,
              pid: 11,
              patient_name: 'John Roe',
              from_name: 'Dr Jones',
              due_date: '2026-07-19',
              due_display: '19/07/2026',
              urgency: 'upcoming',
              urgency_label: 'Upcoming',
              preview: 'Call back',
            },
          ],
          total: 2,
        });
      }
      return Promise.resolve({ rows: [], total: 0 });
    });

    vi.useFakeTimers();
    try {
      render(<CommunicationsHub {...props} initialLens="reminders" />);

      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('John Roe')).toBeInTheDocument();

      const search = document.getElementById('nc-comm-search') as HTMLInputElement;
      search.value = 'jane';
      fireEvent.input(search);

      await act(async () => {
        vi.advanceTimersByTime(350);
        await Promise.resolve();
      });

      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.queryByText('John Roe')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers Create reminder from the empty reminders list', async () => {
    mockFetch.mockImplementation((action: string) => {
      if (action === 'communications.hub_counts') {
        return Promise.resolve({ messages_active: 0, reminders_in_window: 0 });
      }
      if (action === 'communications.reminder_create_options') {
        return Promise.resolve({
          recipients: [{ id: 1, label: 'Myself', is_self: true }],
          date_presets: [],
          priorities: [{ id: 3, label: 'Low' }],
          max_message_length: 160,
          default_priority: 3,
        });
      }
      return Promise.resolve({ rows: [], total: 0 });
    });

    render(<CommunicationsHub {...props} initialLens="reminders" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('No reminders')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create reminder' }));
    });
    expect(screen.getByRole('heading', { name: 'Create reminder' })).toBeInTheDocument();
  });

  it('keeps current rows visible during a background refresh (no Loading flash)', async () => {
    render(<CommunicationsHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();

    // Make the next list load hang — the refresh must not blank the list.
    let resolveList: ((value: unknown) => void) | undefined;
    mockFetch.mockImplementation((action: string) => {
      if (action === 'communications.hub_counts') {
        return Promise.resolve({ messages_active: 2, reminders_in_window: 1 });
      }
      if (action === 'communications.messages_list') {
        return new Promise((resolve) => { resolveList = resolve; });
      }
      return Promise.resolve({ rows: [], total: 0 });
    });

    await act(async () => {
      (document.getElementById('nc-comm-refresh') as HTMLButtonElement).click();
    });

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();

    await act(async () => {
      resolveList?.({ rows: [], total: 0 });
      await Promise.resolve();
    });
  });
});
