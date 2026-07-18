import { afterEach, describe, expect, it, vi } from 'vitest';
import { csvEscape, downloadCsv } from './csv';

describe('csvEscape', () => {
  it('neutralizes spreadsheet formula injection', () => {
    expect(csvEscape('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvEscape('+123')).toBe("'+123");
    expect(csvEscape('@cmd')).toBe("'@cmd");
  });

  it('quotes commas, quotes and newlines', () => {
    expect(csvEscape('Doe, Jane')).toBe('"Doe, Jane"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });
});

describe('downloadCsv', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefixes a UTF-8 BOM so Excel decodes non-ASCII correctly', async () => {
    let captured: Blob | null = null;
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (blob: Blob) => {
        captured = blob;
        return 'blob:test';
      },
      revokeObjectURL: () => {},
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadCsv('x.csv', 'a,b\n1,—');

    expect(click).toHaveBeenCalled();
    expect(captured).not.toBeNull();
    // text() strips a leading BOM during UTF-8 decode (per spec), so assert
    // on the raw bytes: EF BB BF is the UTF-8 BOM.
    const bytes = new Uint8Array(await captured!.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    expect(await captured!.text()).toContain('—');
  });
});
