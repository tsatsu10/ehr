import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const oeFetchMock = vi.fn();
vi.mock('@core/oeFetch', async () => {
  const actual = await vi.importActual<typeof import('@core/oeFetch')>('@core/oeFetch');
  return { ...actual, oeFetch: (...args: unknown[]) => oeFetchMock(...args) };
});

const toastMock = vi.fn();
vi.mock('@components/deskToast', () => ({ showDeskToast: (...args: unknown[]) => toastMock(...args) }));

import { clearVitalsCachesForTest, VitalsDrawer } from './VitalsDrawer';

const fields = {
  required: ['bps', 'bpd', 'pulse', 'temperature', 'weight'],
  units: { bps: 'mmHg', bpd: 'mmHg', pulse: 'bpm', temperature: '°C', weight: 'kg', height: 'cm' },
  labels: {
    bps: 'BP systolic', bpd: 'BP diastolic', pulse: 'Pulse', respiration: 'Resp. rate',
    temperature: 'Temperature', oxygen_saturation: 'SpO₂', weight: 'Weight',
    height: 'Height', waist_circ: 'Waist', note: 'Note',
  },
};

const baseProps = {
  open: true,
  onClose: vi.fn(),
  ajaxUrl: '/ajax.php',
  csrfToken: 'tok',
  visitId: 72,
  patientLabel: 'Test Patient · PT-12',
  onSaved: vi.fn(),
};

describe('VitalsDrawer', () => {
  beforeEach(() => {
    oeFetchMock.mockReset();
    toastMock.mockReset();
    baseProps.onSaved = vi.fn();
    clearVitalsCachesForTest();
  });

  it('loads existing vitals and computes live BMI', async () => {
    oeFetchMock.mockResolvedValueOnce({
      enabled: true, visit_id: 72, vitals_id: 9, saved: true, fields,
      values: { bps: 120, bpd: 80, pulse: 72, temperature: 36.8, weight: 70, height: 170 },
    });
    render(<VitalsDrawer {...baseProps} />);
    expect(await screen.findByDisplayValue('120')).toBeInTheDocument();
    // BMI 70 / 1.7^2 = 24.2 -> Normal
    expect(screen.getByText('BMI 24.2')).toBeInTheDocument();
    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save vitals/i })).toBeEnabled();
  });

  it('disables save until the required fields are present', async () => {
    oeFetchMock.mockResolvedValueOnce({
      enabled: true, visit_id: 72, vitals_id: null, saved: false, fields, values: {},
    });
    render(<VitalsDrawer {...baseProps} />);
    await screen.findByLabelText(/BP systolic/);
    expect(screen.getByRole('button', { name: /Save vitals/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/BP systolic/), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText(/BP diastolic/), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText(/Pulse/), { target: { value: '72' } });
    fireEvent.change(screen.getByLabelText(/Temperature/), { target: { value: '36.8' } });
    fireEvent.change(screen.getByLabelText(/Weight/), { target: { value: '70' } });
    expect(screen.getByRole('button', { name: /Save vitals/i })).toBeEnabled();
  });

  it('saves and calls onSaved with a toast', async () => {
    oeFetchMock.mockResolvedValueOnce({
      enabled: true, visit_id: 72, vitals_id: 9, saved: true, fields,
      values: { bps: 120, bpd: 80, pulse: 72, temperature: 36.8, weight: 70 },
    });
    oeFetchMock.mockResolvedValueOnce({ saved: true, vitals_id: 9, bmi: null, warnings: [] });
    render(<VitalsDrawer {...baseProps} />);
    await screen.findByDisplayValue('120');
    fireEvent.click(screen.getByRole('button', { name: /Save vitals/i }));
    await waitFor(() => expect(baseProps.onSaved).toHaveBeenCalled());
    expect(oeFetchMock).toHaveBeenLastCalledWith('clinical_doc.vitals_save', expect.objectContaining({
      method: 'POST',
      json: expect.objectContaining({ visit_id: 72, vitals_id: 9 }),
    }));
    expect(toastMock).toHaveBeenCalledWith('Vitals saved', 'success');
  });
});
