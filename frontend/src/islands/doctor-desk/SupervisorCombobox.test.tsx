import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { oeFetch } from '@core/oeFetch';
import { SupervisorCombobox } from './SupervisorCombobox';
import type { DoctorVisit } from '@core/types';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
  OeFetchError: class OeFetchError extends Error {},
}));

const mockedFetch = vi.mocked(oeFetch);

const visit = { id: 7, pid: 12, encounter: 99, queue_number: '3', state: 'with_doctor', row_version: 1 } as DoctorVisit;

function baseProps() {
  return {
    visit,
    supervisor: { supervisor_id: null, supervisor_display_name: null, supervisor_from_profile: false },
    ajaxUrl: '/ajax.php',
    csrfToken: 'tok',
    facilityId: 1,
    blocked: false,
    onUpdated: vi.fn(),
    onNotice: vi.fn(),
  };
}

describe('SupervisorCombobox', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    vi.useRealTimers();
  });

  it('shows the current supervisor as a badge when one is set', () => {
    render(
      <SupervisorCombobox
        {...baseProps()}
        supervisor={{ supervisor_id: 4, supervisor_display_name: 'Dr. Owusu', supervisor_from_profile: true }}
      />,
    );
    expect(screen.getByText('Dr. Owusu')).toBeInTheDocument();
    expect(screen.getByText(/Default from your profile/)).toBeInTheDocument();
  });

  it('does not search until at least 2 characters are typed', async () => {
    render(<SupervisorCombobox {...baseProps()} />);
    fireEvent.change(screen.getByLabelText(/Supervising provider/), { target: { value: 'a' } });
    await new Promise((r) => setTimeout(r, 350));
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('searches providers after debounce and shows results', async () => {
    mockedFetch.mockResolvedValue({
      providers: [{ id: 9, display_name: 'Dr. Mensah', username: 'dmensah' }],
    } as never);

    render(<SupervisorCombobox {...baseProps()} />);
    fireEvent.change(screen.getByLabelText(/Supervising provider/), { target: { value: 'me' } });

    await waitFor(
      () => {
        expect(screen.getByText('Dr. Mensah')).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
    expect(mockedFetch).toHaveBeenCalledWith(
      'doctor.search_providers',
      expect.objectContaining({ params: expect.objectContaining({ q: 'me' }) }),
    );
  });

  it('sets a supervisor when a search result is clicked', async () => {
    mockedFetch
      .mockResolvedValueOnce({ providers: [{ id: 9, display_name: 'Dr. Mensah', username: 'dmensah' }] } as never)
      .mockResolvedValueOnce({ supervisor_id: 9, supervisor_display_name: 'Dr. Mensah' } as never);

    const onUpdated = vi.fn();
    const onNotice = vi.fn();
    render(<SupervisorCombobox {...baseProps()} onUpdated={onUpdated} onNotice={onNotice} />);
    fireEvent.change(screen.getByLabelText(/Supervising provider/), { target: { value: 'me' } });

    const resultBtn = await waitFor(() => screen.getByText('Dr. Mensah'), { timeout: 1000 });
    fireEvent.click(resultBtn);

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith({ supervisor_id: 9, supervisor_display_name: 'Dr. Mensah' });
    });
    expect(onNotice).toHaveBeenCalledWith('Supervising provider updated: Dr. Mensah', 'success');
  });

  it('clears the supervisor when the clear button is clicked', async () => {
    mockedFetch.mockResolvedValue({ supervisor_id: null, supervisor_display_name: null } as never);
    const onNotice = vi.fn();
    render(
      <SupervisorCombobox
        {...baseProps()}
        supervisor={{ supervisor_id: 4, supervisor_display_name: 'Dr. Owusu', supervisor_from_profile: false }}
        onNotice={onNotice}
      />,
    );

    fireEvent.click(screen.getByTitle('Clear'));

    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith('Supervising provider cleared', 'success');
    });
    expect(mockedFetch).toHaveBeenCalledWith(
      'doctor.set_supervisor',
      expect.objectContaining({ method: 'POST', json: { encounter_id: 99, supervisor_id: null } }),
    );
  });

  it('shows an error notice when setting the supervisor fails', async () => {
    mockedFetch.mockRejectedValue(new Error('network down'));
    const onNotice = vi.fn();
    render(
      <SupervisorCombobox
        {...baseProps()}
        supervisor={{ supervisor_id: 4, supervisor_display_name: 'Dr. Owusu', supervisor_from_profile: false }}
        onNotice={onNotice}
      />,
    );

    fireEvent.click(screen.getByTitle('Clear'));

    await waitFor(() => {
      expect(onNotice).toHaveBeenCalledWith('Failed to update supervisor: network down', 'danger');
    });
  });

  it('disables the input while blocked', () => {
    render(<SupervisorCombobox {...baseProps()} blocked />);
    expect(screen.getByLabelText(/Supervising provider/)).toBeDisabled();
  });
});
