import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { oeFetch } from '@core/oeFetch';
import { LabQcRangesEditor } from './LabQcRangesEditor';
import type { QcRuleEditorRow } from './labOpsTypes';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));
const mockedFetch = vi.mocked(oeFetch);

function rows(): { rows: QcRuleEditorRow[] } {
  return {
    rows: [
      {
        procedure_code: 'HB',
        label: 'Haemoglobin',
        units: 'g/dL',
        default: { warn_min: 7, warn_max: 18, crit_min: 5, crit_max: 20, reference_range: '7–18' },
        override: null,
        has_override: false,
      },
    ],
  };
}

beforeEach(() => mockedFetch.mockReset());

describe('LabQcRangesEditor', () => {
  it('lazy-loads the ranges only when expanded, then saves an override', async () => {
    mockedFetch.mockResolvedValue(rows() as never);
    render(<LabQcRangesEditor ajaxUrl="/ajax.php" csrfToken="tok" />);

    // Collapsed → no fetch yet.
    expect(mockedFetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Reference & critical ranges/i }));
    await screen.findByText('Haemoglobin');
    expect(mockedFetch).toHaveBeenCalledWith('lab_ops.qc_rules_list', expect.anything());

    // Edit the reference-low field and save.
    const refLow = screen.getByLabelText('Ref low');
    fireEvent.change(refLow, { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const saveCall = mockedFetch.mock.calls.find((c) => c[0] === 'lab_ops.qc_rule_save');
      expect(saveCall?.[1]?.json).toMatchObject({
        procedure_code: 'HB',
        fields: { warn_min: '8' },
      });
    });
  });
});
