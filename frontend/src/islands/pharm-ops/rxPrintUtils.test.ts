import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { openRxPrintPdf } from './rxPrintUtils';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
}));

import { oeFetch } from '@core/oeFetch';

const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

describe('openRxPrintPdf', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      prescription_id: 42,
      print_url: '/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/rx-print.php?prescription_id=42',
    });
    vi.stubGlobal('open', vi.fn(() => ({}) as Window));
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it('requests print URL and opens new tab', async () => {
    await openRxPrintPdf('/ajax', 'token', 42);

    expect(mockFetch).toHaveBeenCalledWith(
      'pharm_ops.rx_print_pdf',
      expect.objectContaining({
        method: 'POST',
        json: { prescription_id: 42 },
      }),
    );
    expect(window.open).toHaveBeenCalledWith(
      '/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/rx-print.php?prescription_id=42',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('throws when pop-up is blocked', async () => {
    vi.mocked(window.open).mockReturnValue(null);

    await expect(openRxPrintPdf('/ajax', 'token', 42)).rejects.toThrow(/Pop-up blocked/);
  });
});
