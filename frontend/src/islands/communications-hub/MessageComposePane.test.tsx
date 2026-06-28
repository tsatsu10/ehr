import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MessageComposePane } from './MessageComposePane';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
}));

vi.mock('@components/PatientSearchDropdown', () => ({
  PatientSearchDropdown: ({
    onSelectPatient,
  }: {
    onSelectPatient: (pid: number, row?: { display_name: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onSelectPatient(42, { display_name: 'Ama Mensah' })}
    >
      Pick patient
    </button>
  ),
}));

import { oeFetch } from '@core/oeFetch';

const mockFetch = vi.mocked(oeFetch);

const composeOptions = {
  note_types: [{ id: 'Note', label: 'Note' }],
  message_statuses: [{ id: 'New', label: 'New' }],
  users: [{ username: 'dr1', label: 'Dr One' }],
  default_status: 'New',
  show_due_date: false,
  reply: null,
};

describe('MessageComposePane', () => {
  beforeEach(() => {
    mockFetch.mockImplementation((action: string) => {
      if (action === 'communications.compose_options') {
        return Promise.resolve(composeOptions);
      }
      if (action === 'communications.message_send') {
        return Promise.resolve({ id: 99 });
      }
      return Promise.resolve({});
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows patient search on new compose', async () => {
    render(
      <MessageComposePane
        ajaxUrl="/ajax"
        csrfToken="token"
        onCancel={vi.fn()}
        onSent={vi.fn()}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Pick patient' })).toBeInTheDocument();
  });

  it('links selected patient and sends with pid', async () => {
    const onSent = vi.fn();

    render(
      <MessageComposePane
        ajaxUrl="/ajax"
        csrfToken="token"
        onCancel={vi.fn()}
        onSent={onSent}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pick patient' }));
    expect(screen.getByText('Ama Mensah')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello team' } });
    fireEvent.click(screen.getByLabelText('Dr One'));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('communications.message_send', expect.objectContaining({
        json: expect.objectContaining({
          pid: 42,
          body: 'Hello team',
        }),
      }));
      expect(onSent).toHaveBeenCalledWith(99);
    });
  });

  it('shows read-only patient on reply', async () => {
    mockFetch.mockImplementation((action: string) => {
      if (action === 'communications.compose_options') {
        return Promise.resolve({
          ...composeOptions,
          reply: {
            note_type: 'Note',
            message_status: 'New',
            pid: 7,
            patient_name: 'Jane Doe',
            assigned_to: ['dr1'],
          },
        });
      }
      return Promise.resolve({});
    });

    render(
      <MessageComposePane
        ajaxUrl="/ajax"
        csrfToken="token"
        replyNoteId={5}
        onCancel={vi.fn()}
        onSent={vi.fn()}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pick patient' })).not.toBeInTheDocument();
  });

  it('shows fax attachment banner when provided', async () => {
    render(
      <MessageComposePane
        ajaxUrl="/ajax"
        csrfToken="token"
        attachment={{ attachment_id: 99, attachment_type: 9, job_id: 'FAX-123' }}
        onCancel={vi.fn()}
        onSent={vi.fn()}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Attaching fax ID: FAX-123/i)).toBeInTheDocument();
  });
});
