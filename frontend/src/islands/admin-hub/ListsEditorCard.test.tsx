import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListsEditorCard } from './ListsEditorCard';
import * as oeFetchModule from '@core/oeFetch';

vi.mock('@core/oeFetch');
const mockedFetch = vi.mocked(oeFetchModule.oeFetch);

const catalog = {
  lists: [
    { list_id: 'note_type', label: 'Patient message note types', option_count: 2, active_count: 2 },
  ],
};
const options = {
  options: [
    { option_id: 'clinical', title: 'Clinical', seq: 10, active: true },
    { option_id: 'admin', title: 'Administrative', seq: 20, active: false },
  ],
};

describe('ListsEditorCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetch.mockImplementation(async (action: string) => {
      if (action === 'admin.lists.catalog') return catalog as never;
      if (action === 'admin.lists.options') return options as never;
      if (action === 'admin.lists.save') return { options: [...options.options, { option_id: 'lab', title: 'Lab', seq: 30, active: true }] } as never;
      if (action === 'admin.lists.set_active') return options as never;
      return {} as never;
    });
  });

  it('loads the catalog and the first list options on mount', async () => {
    render(<ListsEditorCard ajaxUrl="/ajax.php" csrfToken="tok" />);
    expect(await screen.findByText('Clinical')).toBeInTheDocument();
    expect(screen.getByText('Administrative')).toBeInTheDocument();
    // Hidden option shows "Hidden".
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });

  it('adds a new option through the form', async () => {
    render(<ListsEditorCard ajaxUrl="/ajax.php" csrfToken="tok" />);
    await screen.findByText('Clinical');

    fireEvent.click(screen.getByRole('button', { name: 'Add option' }));
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Lab' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(
        'admin.lists.save',
        expect.objectContaining({
          json: expect.objectContaining({ list_id: 'note_type' }),
        }),
      ),
    );
    expect(await screen.findByText('Lab')).toBeInTheDocument();
  });

  it('surfaces a validation error when saving a blank label', async () => {
    render(<ListsEditorCard ajaxUrl="/ajax.php" csrfToken="tok" />);
    await screen.findByText('Clinical');
    fireEvent.click(screen.getByRole('button', { name: 'Add option' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/A label is required/i)).toBeInTheDocument();
  });
});
