import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ReferralEditorDrawer } from './ReferralEditorDrawer';

vi.mock('@core/oeFetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@core/oeFetch')>();
  return { OeFetchError: actual.OeFetchError, oeFetch: vi.fn() };
});

import { oeFetch, OeFetchError } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

const editorData = {
  transaction_id: 65,
  pid: 1,
  fingerprint: 'abc123',
  fields: {
    refer_date: '2026-07-15',
    refer_to: 'Regional Hospital — Surgery',
    refer_diag: 'Suspected appendicitis',
    refer_risk_level: 'high',
    body: 'RLQ pain 2 days',
  },
  has_meta: false,
  status: null,
  risk_levels: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ],
};

describe('ReferralEditorDrawer', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('loads the referral fields and saves the update', async () => {
    mockFetch.mockResolvedValueOnce(editorData).mockResolvedValueOnce({ transaction_id: 65 });

    render(
      <ReferralEditorDrawer
        open
        onClose={() => {}}
        ajaxUrl="/mock/ajax"
        csrfToken="t"
        transactionId={65}
        patientLabel="Smith, Sam · MRN 1"
        onSaved={() => {}}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByLabelText(/Refer to/)).toHaveValue('Regional Hospital — Surgery');
    expect(screen.getByLabelText('Risk level')).toHaveValue('high');

    fireEvent.change(screen.getByLabelText('Referrer diagnosis'), { target: { value: 'Acute appendicitis' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save referral/i }));
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'chart_depth.referral_update',
      expect.objectContaining({
        method: 'POST',
        json: expect.objectContaining({
          transaction_id: 65,
          expected_fingerprint: 'abc123',
          fields: expect.objectContaining({ refer_diag: 'Acute appendicitis' }),
        }),
      }),
    );
  });

  it('keeps the typed values and warns when someone else changed the referral (409)', async () => {
    mockFetch
      .mockResolvedValueOnce(editorData)
      .mockRejectedValueOnce(new OeFetchError('conflict', 409, 'conflict'))
      .mockResolvedValueOnce({ ...editorData, fingerprint: 'fresh456' });

    render(
      <ReferralEditorDrawer
        open
        onClose={() => {}}
        ajaxUrl="/mock/ajax"
        csrfToken="t"
        transactionId={65}
        patientLabel=""
        onSaved={() => {}}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText('Referrer diagnosis'), { target: { value: 'My local edit' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save referral/i }));
    });

    // Form must not wipe: the local edit survives the conflict.
    expect(screen.getByLabelText('Referrer diagnosis')).toHaveValue('My local edit');
    expect(screen.getByText(/Your entries are kept/i)).toBeInTheDocument();

    // A second save now carries the refreshed token (conscious overwrite).
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save referral/i }));
    });
    expect(mockFetch).toHaveBeenLastCalledWith(
      'chart_depth.referral_update',
      expect.objectContaining({
        json: expect.objectContaining({ expected_fingerprint: 'fresh456' }),
      }),
    );
  });

  it('blocks save when refer-to is emptied', async () => {
    mockFetch.mockResolvedValueOnce(editorData);

    render(
      <ReferralEditorDrawer
        open
        onClose={() => {}}
        ajaxUrl="/mock/ajax"
        csrfToken="t"
        transactionId={65}
        patientLabel=""
        onSaved={() => {}}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText(/Refer to/), { target: { value: '   ' } });

    expect(screen.getByRole('button', { name: /Save referral/i })).toBeDisabled();
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('reveals the reply section when a counter-referral exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ...editorData,
      fields: { ...editorData.fields, reply_findings: 'Appendectomy done' },
    });

    render(
      <ReferralEditorDrawer
        open
        onClose={() => {}}
        ajaxUrl="/mock/ajax"
        csrfToken="t"
        transactionId={65}
        patientLabel=""
        onSaved={() => {}}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Findings')).toHaveValue('Appendectomy done');
  });
});
