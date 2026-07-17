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

  it('has no warning for a clean file', () => {
    const out = parseCsv('name,phone\nAma,024\n');
    expect(out.warning).toBeNull();
  });

  it('flags an unterminated quote as a warning without failing the parse', () => {
    // The unclosed quote on row 2 makes papaparse record a non-fatal
    // "MissingQuotes" error, but it still returns usable rows.
    const out = parseCsv('name,phone\nAma,"024\nKwame,025\n');
    expect(out.error).toBeNull();
    expect(out.rows.length).toBeGreaterThan(0);
    expect(out.warning).toMatch(/formatting issue/i);
    expect(out.warning).toMatch(/row 2/i);
  });
});
