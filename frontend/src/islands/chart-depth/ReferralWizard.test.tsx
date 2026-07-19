import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const oeFetchMock = vi.fn();
vi.mock('@core/oeFetch', async () => {
  const actual = await vi.importActual<typeof import('@core/oeFetch')>('@core/oeFetch');
  return { ...actual, oeFetch: (...args: unknown[]) => oeFetchMock(...args) };
});

import { ReferralWizard } from './ReferralWizard';

const baseProps = {
  open: true,
  ajaxUrl: '/ajax.php',
  csrfToken: 'tok',
  pid: 523,
  encounterId: 900,
  patientLabel: 'Ama Mensah · 523',
  onClose: vi.fn(),
  onSaved: vi.fn(),
};

describe('ReferralWizard', () => {
  beforeEach(() => {
    oeFetchMock.mockReset();
  });

  it('seeds the clinical-reason step from the eye-exam prefill without touching typed fields', async () => {
    render(
      <ReferralWizard
        {...baseProps}
        initialValues={{
          chief_complaint: 'Eye examination — specialist review requested',
          summary: 'Eye examination findings:\nVisual acuity: R 6/36 (unaided)',
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Destination facility/), {
      target: { value: 'Regional Eye Centre' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByLabelText('Chief complaint')).toHaveValue('Eye examination — specialist review requested');
    expect(screen.getByLabelText(/Clinical summary/)).toHaveValue(
      'Eye examination findings:\nVisual acuity: R 6/36 (unaided)',
    );

    // The clinician's own edits win over the prefill.
    fireEvent.change(screen.getByLabelText(/Clinical summary/), { target: { value: 'My own summary' } });
    expect(screen.getByLabelText(/Clinical summary/)).toHaveValue('My own summary');
  });

  it('leaves the composer empty when no prefill is passed', () => {
    render(<ReferralWizard {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/Destination facility/), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText(/Clinical summary/)).toHaveValue('');
  });
});
