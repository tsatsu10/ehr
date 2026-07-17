import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const oeFetchMock = vi.fn();
vi.mock('@core/oeFetch', async () => {
  const actual = await vi.importActual<typeof import('@core/oeFetch')>('@core/oeFetch');
  return { ...actual, oeFetch: (...args: unknown[]) => oeFetchMock(...args) };
});

const toastMock = vi.fn();
vi.mock('@components/deskToast', () => ({ showDeskToast: (...args: unknown[]) => toastMock(...args) }));

import { clearEyeExamCachesForTest, EyeExamDrawer } from './EyeExamDrawer';

const meta = {
  acuity_values: ['6/6', '6/18', '6/60', 'CF', 'HM', 'PL', 'NPL'],
  antseg_findings: { normal: 'Normal', cataract: 'Cataract' },
  fundus_findings: { normal: 'Normal', cupped_disc: 'Cupped disc' },
  iop_methods: { icare: 'iCare' },
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

describe('EyeExamDrawer', () => {
  beforeEach(() => {
    oeFetchMock.mockReset();
    toastMock.mockReset();
    baseProps.onSaved = vi.fn();
    clearEyeExamCachesForTest();
  });

  it('loads the exam, hides fundus findings until examined is ticked', async () => {
    oeFetchMock.mockResolvedValueOnce({
      enabled: true, visit_id: 72, exam_id: null, saved: false, values: {}, meta,
    });
    render(<EyeExamDrawer {...baseProps} />);
    await screen.findByText('Visual acuity');
    expect(screen.queryByText('Cupped disc')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Right examined'));
    expect(screen.getByText('Cupped disc')).toBeInTheDocument();
  });

  it('toggles finding chips and saves the exam with the refer flag', async () => {
    oeFetchMock.mockResolvedValueOnce({
      enabled: true, visit_id: 72, exam_id: null, saved: false, values: {}, meta,
    });
    oeFetchMock.mockResolvedValueOnce({ saved: true, exam_id: 4, refer: true });
    render(<EyeExamDrawer {...baseProps} />);
    await screen.findByText('Visual acuity');
    fireEvent.click(screen.getAllByRole('button', { name: 'Cataract' })[0]);
    expect(screen.getAllByRole('button', { name: 'Cataract' })[0]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByLabelText('Refer to eye specialist'));
    fireEvent.click(screen.getByRole('button', { name: /Save eye exam/i }));
    await waitFor(() => expect(baseProps.onSaved).toHaveBeenCalled());
    const call = oeFetchMock.mock.calls.at(-1);
    expect(call?.[0]).toBe('clinical_doc.eye_exam_save');
    expect((call?.[1] as { json: { values: Record<string, unknown> } }).json.values.antseg_r).toEqual(['cataract']);
    expect(toastMock).toHaveBeenCalledWith('Eye exam saved — remember to write the referral letter', 'success');
  });

  it('loads a saved exam with prior values', async () => {
    oeFetchMock.mockResolvedValueOnce({
      enabled: true, visit_id: 72, exam_id: 4, saved: true,
      values: { acuity_r_unaided: '6/18', antseg_r: ['cataract'], fundus_examined_r: 1, fundus_r: ['cupped_disc'] },
      meta,
    });
    render(<EyeExamDrawer {...baseProps} />);
    await screen.findByText('Visual acuity');
    expect(screen.getByLabelText('Unaided', { selector: '#nc-eye-acuity_r_unaided' })).toHaveValue('6/18');
    expect(screen.getAllByRole('button', { name: 'Cataract' })[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Cupped disc')).toBeInTheDocument();
  });
});
