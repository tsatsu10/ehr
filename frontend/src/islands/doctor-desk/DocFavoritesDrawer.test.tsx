import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchClinicalDocFavorites, openClinicalDocForm } from '../clinical-doc/clinicalDocApi';
import { DocFavoritesDrawer } from './DocFavoritesDrawer';
import type { DoctorVisit } from '@core/types';

vi.mock('../clinical-doc/clinicalDocApi', () => ({
  fetchClinicalDocFavorites: vi.fn(),
  openClinicalDocForm: vi.fn(),
}));

const mockedFetchFavorites = vi.mocked(fetchClinicalDocFavorites);
const mockedOpenForm = vi.mocked(openClinicalDocForm);

const visit = { id: 7, pid: 12, encounter: 99, queue_number: '3', state: 'with_doctor', row_version: 1 } as DoctorVisit;

function baseProps() {
  return {
    open: true,
    visit,
    ajaxUrl: '/ajax.php',
    csrfToken: 'tok',
    blocked: false,
    onClose: vi.fn(),
    onError: vi.fn(),
  };
}

describe('DocFavoritesDrawer', () => {
  beforeEach(() => {
    mockedFetchFavorites.mockReset();
    mockedOpenForm.mockReset();
  });

  it('loads and lists favorites with their status line', async () => {
    mockedFetchFavorites.mockResolvedValue({
      favorites: [
        { id: 'vitals', title: 'Vitals', description: 'Vital signs', started: false, primary: true, formdir: 'vitals' },
      ],
      documentation_hub_url: '/hub',
    } as never);

    render(<DocFavoritesDrawer {...baseProps()} />);

    expect(await screen.findByText('Vitals')).toBeInTheDocument();
    expect(screen.getByText('Required · Not started')).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no favorites', async () => {
    mockedFetchFavorites.mockResolvedValue({ favorites: [], documentation_hub_url: null } as never);
    render(<DocFavoritesDrawer {...baseProps()} />);
    expect(await screen.findByText(/No pinned forms/)).toBeInTheDocument();
  });

  it('shows an error message when loading favorites fails', async () => {
    mockedFetchFavorites.mockRejectedValue(new Error('load failed'));
    render(<DocFavoritesDrawer {...baseProps()} />);
    expect(await screen.findByText('load failed')).toBeInTheDocument();
  });

  it('opens a favorite when its button is clicked', async () => {
    mockedFetchFavorites.mockResolvedValue({
      favorites: [
        { id: 'vitals', title: 'Vitals', description: '', started: true, primary: false, formdir: 'vitals' },
      ],
      documentation_hub_url: null,
    } as never);
    mockedOpenForm.mockResolvedValue(undefined as never);

    render(<DocFavoritesDrawer {...baseProps()} />);
    const openBtn = await screen.findByRole('button', { name: 'Continue' });
    fireEvent.click(openBtn);

    await waitFor(() => {
      expect(mockedOpenForm).toHaveBeenCalledWith(
        '/ajax.php',
        'tok',
        7,
        expect.objectContaining({ id: 'vitals' }),
        { returnTo: 'doctor' },
      );
    });
  });

  it('reports an error via onError when opening a favorite fails', async () => {
    mockedFetchFavorites.mockResolvedValue({
      favorites: [{ id: 'vitals', title: 'Vitals', description: '', started: false, primary: false, formdir: 'vitals' }],
      documentation_hub_url: null,
    } as never);
    mockedOpenForm.mockRejectedValue(new Error('cannot open'));
    const onError = vi.fn();

    render(<DocFavoritesDrawer {...baseProps()} onError={onError} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('cannot open');
    });
  });

  it('disables "Open full documentation" until a hub URL is loaded', async () => {
    mockedFetchFavorites.mockResolvedValue({ favorites: [], documentation_hub_url: null } as never);
    render(<DocFavoritesDrawer {...baseProps()} />);
    await screen.findByText(/No pinned forms/);
    expect(screen.getByRole('button', { name: 'Open full documentation' })).toBeDisabled();
  });
});
