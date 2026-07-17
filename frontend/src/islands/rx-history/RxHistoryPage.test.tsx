import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { oeFetch } from '@core/oeFetch';
import { RxHistoryPage } from './RxHistoryPage';
import type { RxHistoryPayload, RxHistoryRow } from './rxHistoryTypes';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));

const mockedFetch = vi.mocked(oeFetch);

function row(overrides: Partial<RxHistoryRow> = {}): RxHistoryRow {
  return {
    id: 1,
    drug: 'Amoxicillin 500mg',
    sig: '500mg PO q8',
    quantity: '21',
    refills: 0,
    status: 'dispensed',
    start_date: '01 Jul 2026',
    end_date: null,
    date_added: '01 Jul 2026',
    provider_name: 'Dr. Owusu',
    encounter: 3,
    editable: false,
    visit_id: null,
    ...overrides,
  };
}

function payload(overrides: Partial<RxHistoryPayload> = {}): RxHistoryPayload {
  return {
    rows: [row()],
    total: 1,
    page: 1,
    page_size: 25,
    patient_name: 'Ama Owusu',
    ...overrides,
  };
}

function baseProps() {
  return {
    ajaxUrl: '/ajax.php',
    csrfToken: 'tok',
    moduleUrl: '/module',
    pid: 20,
  };
}

describe('RxHistoryPage', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('loads and renders rows with the patient name', async () => {
    mockedFetch.mockResolvedValue(payload() as never);
    render(<RxHistoryPage {...baseProps()} />);

    expect(await screen.findByText('Amoxicillin 500mg')).toBeInTheDocument();
    expect(screen.getByText(/Ama Owusu/)).toBeInTheDocument();
  });

  it('shows an empty state when there are no prescriptions', async () => {
    mockedFetch.mockResolvedValue(payload({ rows: [], total: 0 }) as never);
    render(<RxHistoryPage {...baseProps()} />);

    expect(await screen.findByText('No prescriptions found.')).toBeInTheDocument();
  });

  it('shows an error state when the load fails', async () => {
    mockedFetch.mockRejectedValue(new Error('boom'));
    render(<RxHistoryPage {...baseProps()} />);

    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  it('resets to page 1 and refetches when the status filter changes', async () => {
    mockedFetch.mockResolvedValue(payload() as never);
    render(<RxHistoryPage {...baseProps()} />);
    await screen.findByText('Amoxicillin 500mg');
    mockedFetch.mockClear();

    fireEvent.click(screen.getByRole('tab', { name: 'Discontinued' }));

    await waitFor(() => {
      expect(mockedFetch).toHaveBeenCalledWith(
        'pharmacy.rx_history',
        expect.objectContaining({ params: expect.objectContaining({ status: 'discontinued', page: '1' }) }),
      );
    });
  });

  it('shows only Print (no Edit) for a non-editable row', async () => {
    mockedFetch.mockResolvedValue(
      payload({ rows: [row({ id: 1, editable: false, visit_id: null })] }) as never,
    );
    render(<RxHistoryPage {...baseProps()} />);
    await screen.findByText('Amoxicillin 500mg');

    const trigger = screen.getByRole('button', { name: 'Actions for Amoxicillin 500mg' });
    fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Print' })).toHaveAttribute(
        'href',
        '/module/rx-print.php?prescription_id=1',
      );
    });
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('shows an Edit action pointing at rx-edit.php for an editable row', async () => {
    mockedFetch.mockResolvedValue(
      payload({ rows: [row({ id: 2, drug: 'Paracetamol', editable: true, visit_id: 44 })] }) as never,
    );
    render(<RxHistoryPage {...baseProps()} />);
    await screen.findByText('Paracetamol');

    const trigger = screen.getByRole('button', { name: 'Actions for Paracetamol' });
    fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveAttribute(
        'href',
        '/module/rx-edit.php?visit_id=44&rx_id=2&return_to=pharmacy',
      );
    });
  });

  it('renders no bulk-select checkboxes anywhere (v1 scope stays view + print only)', async () => {
    mockedFetch.mockResolvedValue(payload() as never);
    render(<RxHistoryPage {...baseProps()} />);
    await screen.findByText('Amoxicillin 500mg');

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});
