import { describe, expect, it } from 'vitest';
import { findInFileDuplicates } from './fileDuplicates';

describe('findInFileDuplicates', () => {
  it('flags a later row repeating name+dob', () => {
    const rows = [
      { fname: 'Ama', lname: 'Mensah', dob: '12/03/1988' },
      { fname: 'ama', lname: 'MENSAH', dob: '12/03/1988' },
    ];
    const dups = findInFileDuplicates(rows as Record<string, string>[]);
    expect(dups.has(0)).toBe(false);
    expect(dups.get(1)).toMatch(/same name and date of birth/i);
  });

  it('does not flag siblings sharing a phone', () => {
    const rows = [
      { fname: 'Ama', lname: 'Mensah', dob: '12/03/1988', phone: '0244123456' },
      { fname: 'Kojo', lname: 'Mensah', dob: '01/01/2015', phone: '0244123456' },
    ];
    expect(findInFileDuplicates(rows as Record<string, string>[]).size).toBe(0);
  });
});
