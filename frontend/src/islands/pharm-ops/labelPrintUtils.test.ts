import { describe, expect, it, vi, beforeEach } from 'vitest';
import { openDispenseLabelPdf } from './labelPrintUtils';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
}));

import { oeFetch } from '@core/oeFetch';

describe('openDispenseLabelPdf', () => {
  beforeEach(() => {
    vi.mocked(oeFetch).mockReset();
    vi.stubGlobal('open', vi.fn(() => ({}) as Window));
  });

  it('opens print URL from server', async () => {
    vi.mocked(oeFetch).mockResolvedValue({
      sale_id: 9,
      print_url: '/openemr/.../dispense-label.php?sale_id=9',
    });

    await openDispenseLabelPdf('/ajax', 'token', 9);

    expect(oeFetch).toHaveBeenCalledWith('pharm_ops.dispense_label_pdf', expect.objectContaining({
      json: { sale_id: 9 },
      method: 'POST',
    }));
    expect(window.open).toHaveBeenCalledWith(
      '/openemr/.../dispense-label.php?sale_id=9',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('appends print=1 when autoPrint is true', async () => {
    vi.mocked(oeFetch).mockResolvedValue({
      sale_id: 9,
      print_url: '/label.php?sale_id=9',
    });

    await openDispenseLabelPdf('/ajax', 'token', 9, true);

    expect(window.open).toHaveBeenCalledWith(
      '/label.php?sale_id=9&print=1',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
