import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { printMessageThread } from './printMessageThread';

describe('printMessageThread', () => {
  const write = vi.fn();
  const close = vi.fn();
  const focus = vi.fn();
  const print = vi.fn();

  beforeEach(() => {
    write.mockReset();
    close.mockReset();
    focus.mockReset();
    print.mockReset();
    vi.stubGlobal('open', vi.fn(() => ({
      document: { write, close },
      focus,
      print,
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens a print window with message metadata and thread', () => {
    printMessageThread({
      patient_name: 'Jane Doe',
      type: 'Note',
      from_name: 'Dr Smith',
      date_display: 'Jun 27',
      status: 'New',
      thread_html: '<p>Hello</p>',
    });

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(write).toHaveBeenCalledTimes(1);
    const html = write.mock.calls[0][0] as string;
    expect(html).toContain('Jane Doe');
    expect(html).toContain('Dr Smith');
    expect(html).toContain('<p>Hello</p>');
    expect(close).toHaveBeenCalled();
    expect(print).toHaveBeenCalled();
  });
});
