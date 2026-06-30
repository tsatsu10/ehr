import { describe, expect, it } from 'vitest';
import {
  ADMIN_SETTING_KEYS,
  REACT_KILL_SWITCH_KEYS,
  visibleQueueFieldKeys,
} from './adminFieldDefs';

describe('adminFieldDefs', () => {
  it('keeps React kill-switch keys on save payload but off the queue tab', () => {
    for (const key of REACT_KILL_SWITCH_KEYS) {
      expect(ADMIN_SETTING_KEYS).toContain(key);
      expect(visibleQueueFieldKeys()).not.toContain(key);
    }
  });

  it('shows billing back office product flags on the queue tab', () => {
    const visible = visibleQueueFieldKeys();
    expect(visible).toContain('enable_bill_ops');
    expect(visible).toContain('enable_bill_ops_outstanding');
    expect(visible).not.toContain('enable_react_bill_ops');
  });
});
