import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { oeFetch } from '@core/oeFetch';
import { ProcOrderForm } from './ProcOrderForm';
import type { ProcOrderFormData, ProcOrderSaveResult } from './procOrderTypes';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));
vi.mock('@components/deskToast', () => ({ showDeskToast: vi.fn() }));

const mockedFetch = vi.mocked(oeFetch);

function formData(overrides: Partial<ProcOrderFormData> = {}): ProcOrderFormData {
  return {
    enabled: true,
    visit_id: 10,
    pid: 5,
    encounter: 3,
    facility_id: 1,
    patient_name: 'Ama Owusu',
    labs: [
      {
        ppid: 1,
        name: 'OpenEMR Lab',
        is_inhouse: true,
        tests: [
          { procedure_type_id: 101, name: 'Malaria RDT', code: 'MAL', fee_amount: 20, has_fee: true },
          { procedure_type_id: 102, name: 'Full Blood Count', code: 'FBC', fee_amount: null, has_fee: false },
        ],
      },
    ],
    priority_options: [
      { id: 'normal', title: 'Routine' },
      { id: 'stat', title: 'STAT' },
    ],
    specimen_options: [{ id: '119297000', title: 'Blood specimen' }],
    default_lab_id: 1,
    auto_bill_on_order: true,
    currency_symbol: 'GH₵',
    order: null,
    ...overrides,
  };
}

const saveResult: ProcOrderSaveResult = {
  procedure_order_id: 77,
  visit_id: 10,
  test_count: 1,
  is_new: true,
  billing: { posted_count: 1, charges_total: 20 },
};

beforeEach(() => {
  mockedFetch.mockReset();
  // jsdom has no navigation; make href assignable so submit() doesn't throw.
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
  });
});

function baseProps() {
  return {
    ajaxUrl: '/ajax.php',
    csrfToken: 'tok',
    visitId: 10,
    facilityId: 1,
    returnUrl: '/back',
  };
}

describe('ProcOrderForm', () => {
  it('loads the catalog and disables Place order until a test is selected', async () => {
    mockedFetch.mockResolvedValue(formData() as never);
    render(<ProcOrderForm {...baseProps()} />);

    expect(await screen.findByText('Malaria RDT')).toBeInTheDocument();
    expect(screen.getByText('Ama Owusu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled();
    expect(mockedFetch).toHaveBeenCalledWith(
      'proc_order.form_data',
      expect.objectContaining({
        params: expect.objectContaining({ visit_id: '10', procedure_order_id: '0' }),
      }),
    );
  });

  it('selects a test by clicking anywhere on its row, not just the checkbox', async () => {
    // Regression guard (2026-07-14 audit): the redesign wraps each test row in
    // a <label> so the whole card is clickable, not just the checkbox itself.
    // Confirm the row text actually forwards the click to the checkbox.
    mockedFetch.mockResolvedValue(formData() as never);
    render(<ProcOrderForm {...baseProps()} />);

    await screen.findByText('Malaria RDT');
    const checkbox = screen.getByLabelText(/Malaria RDT/);
    expect(checkbox).not.toBeChecked();

    fireEvent.click(screen.getByText('Malaria RDT'));

    expect(checkbox).toBeChecked();
    expect(screen.getByRole('button', { name: 'Place order' })).toBeEnabled();
  });

  it('posts the selected tests, priority and lab to proc_order.save', async () => {
    mockedFetch.mockImplementation((action) =>
      Promise.resolve((action === 'proc_order.form_data' ? formData() : saveResult) as never),
    );
    render(<ProcOrderForm {...baseProps()} />);
    await screen.findByText('Malaria RDT');

    fireEvent.click(screen.getByLabelText(/Malaria RDT/));
    const place = screen.getByRole('button', { name: 'Place order' });
    expect(place).toBeEnabled();
    fireEvent.click(place);

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(
        'proc_order.save',
        expect.objectContaining({
          json: expect.objectContaining({
            visit_id: 10,
            lab_id: 1,
            order_priority: 'normal',
            procedure_type_ids: [101],
          }),
        }),
      ),
    );
  });

  it('pre-selects existing order tests in edit mode', async () => {
    mockedFetch.mockResolvedValue(
      formData({
        order: {
          procedure_order_id: 55,
          lab_id: 1,
          order_priority: 'stat',
          specimen_type: '119297000',
          specimen_volume: '5ml',
          clinical_hx: 'fever 3 days',
          order_diagnosis: 'ICD10:B54',
          codes: [{ procedure_code: 'MAL', procedure_name: 'Malaria RDT' }],
        },
      }) as never,
    );
    render(<ProcOrderForm {...baseProps()} procedureOrderId={55} />);

    expect(await screen.findByText('Edit lab / procedure order')).toBeInTheDocument();
    expect(screen.getByLabelText(/Malaria RDT/)).toBeChecked();
    expect(screen.getByLabelText(/Full Blood Count/)).not.toBeChecked();
    // Save button reflects edit mode.
    expect(screen.getByRole('button', { name: 'Save order' })).toBeEnabled();
  });

  it('shows the Urgent badge for the default "high"-id priority option', async () => {
    // Regression guard (2026-07-14 audit): the shipped default Order_Priority
    // list has id "high" / title "Urgent" (ProcedureOrderFormService::
    // DEFAULT_PRIORITIES) -- matching only on the id missed this real-world
    // case entirely, since "high" doesn't contain "urgent".
    mockedFetch.mockResolvedValue(
      formData({
        priority_options: [
          { id: 'normal', title: 'Routine' },
          { id: 'high', title: 'Urgent' },
          { id: 'stat', title: 'STAT' },
        ],
        order: {
          procedure_order_id: 55,
          lab_id: 1,
          order_priority: 'high',
          specimen_type: '',
          specimen_volume: '',
          clinical_hx: '',
          order_diagnosis: '',
          codes: [],
        },
      }) as never,
    );
    render(<ProcOrderForm {...baseProps()} procedureOrderId={55} />);

    await screen.findByText('Edit lab / procedure order');
    expect(within(screen.getByRole('banner')).getByText('Urgent')).toBeInTheDocument();
  });
});
