import { afterEach, describe, expect, it } from 'vitest';
import { printHandoverSheet } from './printHandoverSheet';

describe('printHandoverSheet', () => {
  afterEach(() => {
    document.querySelectorAll('iframe').forEach((f) => f.remove());
  });

  it('renders one slip per created account with escaped credentials', () => {
    printHandoverSheet(
      [
        { role: 'new_reception', role_label: 'Reception', username: 'reception', temp_password: 'Abcd2345efgh' },
        { role: 'new_doctor', role_label: '<Doctor>', username: 'doctor', temp_password: 'Wxyz7890jkmn' },
      ],
      'New Clinic',
    );

    const frame = document.querySelector('iframe');
    expect(frame).not.toBeNull();
    const html = frame!.srcdoc;
    expect(html).toContain('reception');
    expect(html).toContain('Abcd2345efgh');
    expect(html).toContain('Wxyz7890jkmn');
    // Role labels are HTML-escaped.
    expect(html).toContain('&lt;Doctor&gt;');
    expect(html).not.toContain('<Doctor>');
    expect(html).toContain('New Clinic');
    expect(html).toContain('change your password');
  });

  it('skips rows without a temp password (already-present roles)', () => {
    printHandoverSheet(
      [{ role: 'new_reception', role_label: 'Reception', username: 'reception' }],
      undefined,
    );

    const html = document.querySelector('iframe')!.srcdoc;
    expect(html).not.toContain('class="slip"');
  });
});
