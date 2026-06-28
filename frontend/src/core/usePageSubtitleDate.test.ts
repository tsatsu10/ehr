import { renderHook } from '@testing-library/react';
import { describe, expect, it, afterEach } from 'vitest';
import { usePageSubtitleDate } from './usePageSubtitleDate';

describe('usePageSubtitleDate', () => {
  afterEach(() => {
    document.getElementById('nc-test-date')?.remove();
  });

  it('writes visit date into the subtitle element', () => {
    const el = document.createElement('div');
    el.id = 'nc-test-date';
    document.body.appendChild(el);

    renderHook(() => usePageSubtitleDate('nc-test-date', '2099-06-27'));
    expect(el.textContent).toBe('2099-06-27');
  });

  it('clears subtitle on unmount', () => {
    const el = document.createElement('div');
    el.id = 'nc-test-date';
    document.body.appendChild(el);

    const { unmount } = renderHook(() => usePageSubtitleDate('nc-test-date', '2099-06-27'));
    unmount();
    expect(el.textContent).toBe('');
  });
});
