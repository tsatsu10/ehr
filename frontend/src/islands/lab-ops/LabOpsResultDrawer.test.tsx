import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { oeFetch } from '@core/oeFetch';
import { LabOpsResultDrawer } from './LabOpsResultDrawer';
import type { ResultEntryForm } from './labOpsTypes';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));

const mockedFetch = vi.mocked(oeFetch);

function entryForm(): ResultEntryForm {
  return {
    order: { patient_name: 'Ama Owusu', pubpid: 'P1', queue_number: 3 },
    lines: [
      {
        procedure_order_seq: 1,
        procedure_name: 'Malaria RDT',
        procedure_code: 'MAL_RDT',
        qc: { allowed: ['negative', 'positive', 'invalid'] },
        results: [],
      },
      {
        procedure_order_seq: 2,
        procedure_name: 'Haemoglobin',
        procedure_code: 'HB',
        qc: { units: 'g/dL', reference_range: '7–18' },
        results: [],
      },
    ],
    validation: { rules_by_seq: {} },
    has_saved_results: false,
  };
}

function baseProps() {
  return {
    open: true,
    orderId: 77,
    ajaxUrl: '/ajax.php',
    csrfToken: 'tok',
    canEnter: true,
    canRelease: false,
    onClose: vi.fn(),
    onSaved: vi.fn(),
  };
}

beforeEach(() => {
  mockedFetch.mockReset();
});

describe('LabOpsResultDrawer result entry', () => {
  it('uses a dropdown for a qualitative test and a text box for a numeric one', async () => {
    mockedFetch.mockResolvedValue(entryForm() as never);
    // SlideOver renders in a portal, so query the document, not the container.
    render(<LabOpsResultDrawer {...baseProps()} />);

    await screen.findByText('Malaria RDT');

    // Qualitative test → a <select> constrained to the defined values, so staff
    // can't type "postive" / "+" / "pos" as free text.
    const malariaLine = document.querySelector('[data-line-index="0"]') as HTMLElement;
    const malariaField = malariaLine.querySelector('[data-field="result"]');
    expect(malariaField?.tagName).toBe('SELECT');
    expect(within(malariaLine).getByRole('option', { name: 'Positive' })).toBeInTheDocument();
    expect(within(malariaLine).getByRole('option', { name: 'Negative' })).toBeInTheDocument();

    // Numeric test → stays a free-text input (values aren't a fixed set).
    const hbLine = document.querySelector('[data-line-index="1"]') as HTMLElement;
    const hbField = hbLine.querySelector('[data-field="result"]');
    expect(hbField?.tagName).toBe('INPUT');
  });

  it('shows a critical-value callout when a result is beyond the panic threshold (D-LAB-CRIT)', async () => {
    const form = entryForm();
    form.lines = [
      {
        procedure_order_seq: 2,
        procedure_name: 'Haemoglobin',
        procedure_code: 'HB',
        qc: { units: 'g/dL', reference_range: '7–18' },
        results: [{ result: '4.0' }],
      },
    ];
    form.validation = {
      rules_by_seq: { 2: { type: 'numeric', label: 'Haemoglobin', crit_min: 5, crit_max: 20, units: 'g/dL' } },
    };
    form.has_saved_results = false;
    mockedFetch.mockResolvedValue(form as never);

    render(<LabOpsResultDrawer {...baseProps()} />);

    expect(await screen.findByText(/Critical result — notify the clinician now/i)).toBeInTheDocument();
    expect(screen.getByText(/Haemoglobin critically LOW/i)).toBeInTheDocument();
  });

  it('captures the critical-value notification before releasing (SLIPTA)', async () => {
    const form = entryForm();
    form.lines = [
      {
        procedure_order_seq: 2,
        procedure_name: 'Haemoglobin',
        procedure_code: 'HB',
        qc: { units: 'g/dL', reference_range: '7–18' },
        results: [{ result: '4.0' }],
      },
    ];
    form.validation = {
      rules_by_seq: { 2: { type: 'numeric', label: 'Haemoglobin', crit_min: 5, crit_max: 20, units: 'g/dL' } },
    };
    form.has_saved_results = true;
    mockedFetch.mockResolvedValue(form as never);

    render(<LabOpsResultDrawer {...baseProps()} canRelease />);

    fireEvent.click(await screen.findByRole('button', { name: 'Release to doctor' }));

    // Release must not fire yet — the read-back modal opens first.
    expect(screen.getByText('Record critical-value notification')).toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalledWith('lab_ops.result_release', expect.anything());

    // Confirm is blocked until a clinician name is entered.
    const confirm = screen.getByRole('button', { name: 'Record & release' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Clinician notified'), { target: { value: 'Dr Mensah' } });
    fireEvent.click(confirm);

    const releaseCall = mockedFetch.mock.calls.find((c) => c[0] === 'lab_ops.result_release');
    expect(releaseCall).toBeDefined();
    expect(releaseCall?.[1]?.json).toMatchObject({
      procedure_order_id: 77,
      critical_notification: { notified_name: 'Dr Mensah' },
    });
  });

  it('gates editing a released result behind an amendment reason (D-LAB-AMEND)', async () => {
    const form = entryForm();
    form.has_saved_results = true;
    form.already_released = true;
    mockedFetch.mockResolvedValue(form as never);

    render(<LabOpsResultDrawer {...baseProps()} canRelease />);

    // A released order offers "Amend result", not a plain edit — and must NOT offer a plain
    // re-release that would skip the amendment reason gate.
    await screen.findByRole('button', { name: 'Amend result' });
    expect(screen.queryByRole('button', { name: 'Release to doctor' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Amend result' }));
    expect(screen.getByText('Amend released result')).toBeInTheDocument();

    // Confirm is blocked until a reason is given.
    const confirm = screen.getByRole('button', { name: 'Start amendment' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Reason for correction'), {
      target: { value: 'transcription error' },
    });
    fireEvent.click(confirm);

    await waitFor(() => {
      const amendCall = mockedFetch.mock.calls.find((c) => c[0] === 'lab_ops.result_amend');
      expect(amendCall?.[1]?.json).toMatchObject({
        procedure_order_id: 77,
        reason: 'transcription error',
      });
    });
  });
});
