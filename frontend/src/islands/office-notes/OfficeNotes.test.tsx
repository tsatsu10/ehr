import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { oeFetch } from '@core/oeFetch';
import { OfficeNotes } from './OfficeNotes';
import type { OfficeNotesListResponse } from './officeNotesTypes';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));

const mockedFetch = vi.mocked(oeFetch);

function listResponse(notes: OfficeNotesListResponse['notes']): OfficeNotesListResponse {
  return { notes, total: notes.length, offset: 0, page_size: 20, filter: 'active' };
}

const sampleNotes = [
  { id: 5, body: 'Fridge in break room is broken', user: 'ama', date: '2026-07-10 08:30:00', active: true, pinned: true },
  { id: 4, body: 'Dr. Mensah away Friday', user: 'selorm', date: '2026-07-09 17:05:00', active: true, pinned: false },
];

beforeEach(() => {
  mockedFetch.mockReset();
});

describe('OfficeNotes', () => {
  it('renders the notes feed from onotes.list', async () => {
    mockedFetch.mockResolvedValue(listResponse(sampleNotes) as never);
    render(<OfficeNotes ajaxUrl="/ajax.php" csrfToken="token" />);

    expect(await screen.findByText('Fridge in break room is broken')).toBeInTheDocument();
    expect(screen.getByText('Dr. Mensah away Friday')).toBeInTheDocument();
    // Regional DD/MM/YYYY formatting.
    expect(screen.getByText('10/07/2026 08:30')).toBeInTheDocument();
    // Pinned note shows the Pinned badge + an Unpin control.
    expect(screen.getByText('Pinned')).toBeInTheDocument();
    expect(mockedFetch).toHaveBeenCalledWith(
      'onotes.list',
      expect.objectContaining({ params: expect.objectContaining({ filter: 'active' }) }),
    );
  });

  it('pins an unpinned note via onotes.pin', async () => {
    mockedFetch.mockResolvedValue(listResponse(sampleNotes) as never);
    render(<OfficeNotes ajaxUrl="/ajax.php" csrfToken="token" />);
    await screen.findByText('Dr. Mensah away Friday');

    // Note id 4 (Dr. Mensah) is unpinned -> its control is "Pin note".
    fireEvent.click(screen.getByRole('button', { name: 'Pin note' }));
    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(
        'onotes.pin',
        expect.objectContaining({ json: { id: 4, pinned: true } }),
      ),
    );
  });

  it('shows the empty state when there are no notes', async () => {
    mockedFetch.mockResolvedValue(listResponse([]) as never);
    render(<OfficeNotes ajaxUrl="/ajax.php" csrfToken="token" />);

    expect(await screen.findByText('No notes here')).toBeInTheDocument();
  });

  it('disables Add note until text is entered, then posts onotes.save', async () => {
    mockedFetch.mockResolvedValue(listResponse([]) as never);
    render(<OfficeNotes ajaxUrl="/ajax.php" csrfToken="token" />);
    await screen.findByText('No notes here');

    const addButton = screen.getByRole('button', { name: 'Add note' });
    expect(addButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('New office note'), {
      target: { value: 'Order more gloves' },
    });
    expect(addButton).toBeEnabled();

    fireEvent.click(addButton);
    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(
        'onotes.save',
        expect.objectContaining({ json: { id: 0, body: 'Order more gloves' } }),
      ),
    );
  });
});
