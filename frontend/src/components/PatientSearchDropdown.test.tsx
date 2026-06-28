import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PatientSearchDropdown } from './PatientSearchDropdown';

vi.mock('@core/usePatientSearch', () => ({
  usePatientSearch: vi.fn(),
}));

import { usePatientSearch } from '@core/usePatientSearch';

const mockedUsePatientSearch = vi.mocked(usePatientSearch);

describe('PatientSearchDropdown', () => {
  beforeEach(() => {
    mockedUsePatientSearch.mockReturnValue({
      query: '',
      setQuery: vi.fn(),
      results: [],
      selectedIndex: -1,
      setSelectedIndex: vi.fn(),
      searching: false,
      error: null,
      runSearch: vi.fn(),
      handleInput: vi.fn(),
      clearSearch: vi.fn(),
      findPatient: vi.fn(),
    });
  });

  it('renders input with label and placeholder', () => {
    render(
      <PatientSearchDropdown
        ajaxUrl="/ajax"
        csrfToken="token"
        inputId="nc-test-search"
        resultsId="nc-test-results"
        label="Find patient"
        onSelectPatient={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Find patient')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Name or MRN')).toBeInTheDocument();
  });

  it('shows results and calls onSelectPatient when a row is picked', async () => {
    const handleInput = vi.fn();
    const clearSearch = vi.fn();
    const onSelectPatient = vi.fn();

    mockedUsePatientSearch.mockReturnValue({
      query: 'ama',
      setQuery: vi.fn(),
      results: [
        { pid: 7, display_name: 'Ama Mensah', pubpid: 'MRN007' },
      ],
      selectedIndex: 0,
      setSelectedIndex: vi.fn(),
      searching: false,
      error: null,
      runSearch: vi.fn(),
      handleInput,
      clearSearch,
      findPatient: vi.fn(),
    });

    render(
      <PatientSearchDropdown
        ajaxUrl="/ajax"
        csrfToken="token"
        inputId="nc-test-search"
        resultsId="nc-test-results"
        onSelectPatient={onSelectPatient}
      />,
    );

    fireEvent.focus(screen.getByPlaceholderText('Name or MRN'));
    expect(screen.getByText('Ama Mensah')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Ama Mensah'));

    await waitFor(() => {
      expect(clearSearch).toHaveBeenCalled();
      expect(onSelectPatient).toHaveBeenCalledWith(7, {
        pid: 7,
        display_name: 'Ama Mensah',
        pubpid: 'MRN007',
      });
    });
  });
});
