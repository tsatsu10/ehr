import { describe, expect, it } from 'vitest';
import { parseCsv } from './parseCsv';
import { MAX_IMPORT_ROWS } from './types';

describe('parseCsv', () => {
  it('parses headers and rows, handling quoted commas and CRLF', () => {
    const out = parseCsv('name,address\r\nAma,"12 Ring Road, Accra"\r\n');
    expect(out.error).toBeNull();
    expect(out.headers).toEqual(['name', 'address']);
    expect(out.rows).toEqual([['Ama', '12 Ring Road, Accra']]);
  });

  it('strips a UTF-8 BOM from the first header', () => {
    const out = parseCsv('﻿name\nAma\n');
    expect(out.headers).toEqual(['name']);
  });

  it('rejects an empty file', () => {
    expect(parseCsv('').error).toMatch(/empty/i);
  });

  it('rejects files over the row cap with a split hint', () => {
    const big = 'name\n' + Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `P${i}`).join('\n');
    expect(parseCsv(big).error).toMatch(/5,?000/);
  });

  it('drops fully empty rows', () => {
    const out = parseCsv('name,phone\nAma,024\n,\n');
    expect(out.rows).toHaveLength(1);
  });
});
