import { render, act } from '@testing-library/react';
import { vi } from 'vitest';
import { usePageHeadingDateInput } from './usePageHeadingDateInput';

function DateHarness({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  usePageHeadingDateInput('nc-reports-date', value, onChange);
  return null;
}

describe('usePageHeadingDateInput', () => {
  beforeEach(() => {
    document.body.innerHTML = '<input id="nc-reports-date" type="date" value="2026-01-01" />';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('syncs value into the heading date input', () => {
    const onChange = vi.fn();
    render(<DateHarness value="2026-06-27" onChange={onChange} />);

    const input = document.getElementById('nc-reports-date') as HTMLInputElement;
    expect(input.value).toBe('2026-06-27');
  });

  it('calls onChange when the heading date changes', async () => {
    const onChange = vi.fn();
    render(<DateHarness value="2026-06-27" onChange={onChange} />);

    const input = document.getElementById('nc-reports-date') as HTMLInputElement;
    input.value = '2026-06-28';

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith('2026-06-28');
  });
});
