import { describe, expect, it } from 'vitest';
import { autoMatch } from './columnMatch';

describe('autoMatch', () => {
  it('matches common header spellings regardless of case/punctuation', () => {
    expect(autoMatch(['First Name', 'SURNAME', 'Date of Birth', 'Gender', 'Mobile No.', 'Folder No']))
      .toEqual(['fname', 'lname', 'dob', 'sex', 'phone', 'old_clinic_number']);
  });

  it('returns null for headers it cannot place', () => {
    expect(autoMatch(['Blood Group'])).toEqual([null]);
  });

  it('never assigns the same field twice (first wins)', () => {
    expect(autoMatch(['Phone', 'Telephone'])).toEqual(['phone', null]);
  });
});
