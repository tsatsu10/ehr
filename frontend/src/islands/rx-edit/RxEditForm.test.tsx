import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { oeFetch } from '@core/oeFetch';
import { RxEditForm } from './RxEditForm';
import type { RxFormData, RxSaveResult } from './rxEditTypes';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));
vi.mock('@components/deskToast', () => ({ showDeskToast: vi.fn() }));

const mockedFetch = vi.mocked(oeFetch);

function formData(overrides: Partial<RxFormData> = {}): RxFormData {
  return {
    visit_id: 10,
    pid: 5,
    encounter: 3,
    facility_id: 1,
    patient_name: 'Ama Owusu',
    allergies: [],
    existing_prescriptions: [],
    route_options: [{ id: 'oral', title: 'Oral' }],
    interval_options: [{ id: 'bid', title: 'Twice daily' }],
    form_options: [],
    currency_symbol: 'GH₵',
    prescription: null,
    ...overrides,
  };
}

const saveResult: RxSaveResult = {
  prescription_id: 77,
  action: 'created',
  existing_prescriptions: [],
};

function baseProps() {
  return {
    ajaxUrl: '/ajax.php',
    csrfToken: 'tok',
    visitId: 10,
    returnUrl: '/back',
  };
}

describe('RxEditForm', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('loads the form and disables Add prescription until a drug name is entered', async () => {
    mockedFetch.mockResolvedValue(formData() as never);
    render(<RxEditForm {...baseProps()} />);

    expect(await screen.findByText('Ama Owusu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add prescription' })).toBeDisabled();
  });

  it('saves the prescription with typed fields', async () => {
    mockedFetch.mockImplementation((action) =>
      Promise.resolve((action === 'pharmacy.rx_form_data' ? formData() : saveResult) as never),
    );
    render(<RxEditForm {...baseProps()} />);
    await screen.findByText('Ama Owusu');

    fireEvent.change(screen.getByLabelText('Drug name'), { target: { value: 'Amoxicillin' } });
    fireEvent.change(screen.getByLabelText('Dosage / sig'), { target: { value: '500mg' } });

    const addBtn = screen.getByRole('button', { name: 'Add prescription' });
    expect(addBtn).toBeEnabled();
    fireEvent.click(addBtn);

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(
        'pharmacy.rx_save',
        expect.objectContaining({
          json: expect.objectContaining({
            visit_id: 10,
            drug_name: 'Amoxicillin',
            dosage: '500mg',
            // Regression guard (2026-07-14 audit): the server now enforces
            // this flag independently (PrescriptionEditServiceTest::
            // testSavePrescriptionEnforcesAllergyAcknowledgmentServerSide) --
            // the client must actually send it, not just gate the button.
            allergy_acknowledged: false,
          }),
        }),
      ),
    );
  });

  it('requires the allergy acknowledgment before saving when the selected drug matches a documented allergy', async () => {
    mockedFetch.mockImplementation((action) => {
      if (action === 'pharmacy.rx_form_data') {
        return Promise.resolve(formData({ allergies: ['Amoxicillin'] }) as never);
      }
      if (action === 'pharmacy.rx_search_drugs') {
        return Promise.resolve({
          rows: [
            {
              drug_id: 9,
              name: 'Amoxicillin',
              display_name: 'Amoxicillin 500mg',
              form: 'tablet',
              route: 'oral',
              allergy_match: true,
            },
          ],
        } as never);
      }
      return Promise.resolve(saveResult as never);
    });
    render(<RxEditForm {...baseProps()} />);
    await screen.findByText('Ama Owusu');

    fireEvent.change(screen.getByLabelText('Drug name'), { target: { value: 'Amox' } });

    const option = await screen.findByText('Amoxicillin 500mg');
    fireEvent.click(option);

    expect(await screen.findByText('Allergy warning')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add prescription' })).toBeDisabled();

    fireEvent.click(screen.getByLabelText('I verified allergies with the patient'));
    expect(screen.getByRole('button', { name: 'Add prescription' })).toBeEnabled();
  });

  it('requires the allergy acknowledgment for a free-typed drug name too, not just a formulary pick', async () => {
    // Regression guard (2026-07-14 audit): the allergy check originally only
    // looked at the server's precomputed flag on formulary SEARCH RESULTS --
    // a drug typed freehand (no formulary match, explicitly supported by
    // this form) never got checked at all.
    mockedFetch.mockImplementation((action) => {
      if (action === 'pharmacy.rx_form_data') {
        return Promise.resolve(formData({ allergies: ['Sulfamethoxazole'] }) as never);
      }
      if (action === 'pharmacy.rx_search_drugs') {
        return Promise.resolve({ rows: [] } as never);
      }
      return Promise.resolve(saveResult as never);
    });
    render(<RxEditForm {...baseProps()} />);
    await screen.findByText('Ama Owusu');

    fireEvent.change(screen.getByLabelText('Drug name'), {
      target: { value: 'Sulfamethoxazole-Trimethoprim' },
    });

    expect(await screen.findByText('Allergy warning')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add prescription' })).toBeDisabled();
  });

  it('pre-fills an existing prescription in edit mode', async () => {
    mockedFetch.mockResolvedValue(
      formData({
        prescription: {
          prescription_id: 55,
          drug_name: 'Paracetamol 500mg',
          drug_id: 3,
          dosage: '500mg',
          quantity: '20',
          route: 'oral',
          interval: 'bid',
          refills: 1,
          note: '',
          sig: '500mg twice daily',
          prn: false,
          start_date: '2026-07-10',
          end_date: null,
        },
      }) as never,
    );
    render(<RxEditForm {...baseProps()} prescriptionId={55} />);

    expect(await screen.findByText('Edit prescription')).toBeInTheDocument();
    expect(screen.getByLabelText('Drug name')).toHaveValue('Paracetamol 500mg');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
});
