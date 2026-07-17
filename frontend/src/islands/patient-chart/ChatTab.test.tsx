import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatTab } from './ChatTab';
import * as api from './chatApi';
import type { ChartChatMessage } from './patientChartTypes';

vi.mock('./chatApi');

const mockedApi = vi.mocked(api);

const sampleMessages: ChartChatMessage[] = [
  {
    id: 1,
    direction: 'out',
    body: 'Reminder: appointment tomorrow at 9am.',
    author: 'Ama Owusu',
    created_at: '2026-07-15 14:05:00',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ChatTab', () => {
  it('renders the thread from chat.list', async () => {
    mockedApi.listChat.mockResolvedValue({ messages: sampleMessages });
    render(<ChatTab ajaxUrl="/ajax.php" csrfToken="token" pid={42} active />);

    expect(await screen.findByText('Reminder: appointment tomorrow at 9am.')).toBeInTheDocument();
    expect(screen.getByText('Ama Owusu · 15/07/2026 14:05')).toBeInTheDocument();
    expect(mockedApi.listChat).toHaveBeenCalledWith(
      expect.objectContaining({ ajaxUrl: '/ajax.php' }),
      42,
    );
  });

  it('shows the empty state when there are no messages', async () => {
    mockedApi.listChat.mockResolvedValue({ messages: [] });
    render(<ChatTab ajaxUrl="/ajax.php" csrfToken="token" pid={42} active />);

    expect(await screen.findByText('No messages yet')).toBeInTheDocument();
  });

  it('sends a message via chat.send and appends it to the thread', async () => {
    mockedApi.listChat.mockResolvedValue({ messages: [] });
    mockedApi.sendChatMessage.mockResolvedValue({
      id: 2,
      direction: 'out',
      body: 'Please bring your NHIS card.',
      author: 'Ama Owusu',
      created_at: '2026-07-16 09:00:00',
    });
    render(<ChatTab ajaxUrl="/ajax.php" csrfToken="token" pid={42} active />);
    await screen.findByText('No messages yet');

    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Please bring your NHIS card.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() =>
      expect(mockedApi.sendChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ ajaxUrl: '/ajax.php' }),
        42,
        'Please bring your NHIS card.',
      ),
    );
    expect(await screen.findByText('Please bring your NHIS card.')).toBeInTheDocument();
  });

  it('does not fetch when inactive', () => {
    render(<ChatTab ajaxUrl="/ajax.php" csrfToken="token" pid={42} active={false} />);
    expect(mockedApi.listChat).not.toHaveBeenCalled();
  });
});
