import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { ReminderCreatePane } from './ReminderCreatePane';

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
  onCancel: vi.fn(),
  onCreated: vi.fn(),
};

describe('ReminderCreatePane', () => {
  beforeEach(() => {
    mockFetch.mockImplementation((action: string) => {
      if (action === 'communications.reminder_create_options') {
        return Promise.resolve({
          recipients: [{ id: 1, label: 'Myself', is_self: true }],
          date_presets: [{ key: '1_week', label: '1 Week From Now' }],
          priorities: [
            { id: 1, label: 'High' },
            { id: 2, label: 'Medium' },
            { id: 3, label: 'Low' },
          ],
          max_message_length: 160,
          default_priority: 3,
        });
      }
      return Promise.resolve({ ok: true });
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('loads reminder create form', async () => {
    render(<ReminderCreatePane {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'communications.reminder_create_options',
      expect.any(Object),
    );
    expect(await screen.findByRole('heading', { name: 'Create reminder' })).toBeInTheDocument();
    expect(screen.getByLabelText('Myself')).toBeChecked();
  });
});
