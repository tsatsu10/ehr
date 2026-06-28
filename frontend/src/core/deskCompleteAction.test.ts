import { describe, expect, it } from 'vitest';
import { handleDeskCompleteResult } from './deskCompleteAction';

describe('handleDeskCompleteResult', () => {
  it('calls onSuccess when complete succeeds', () => {
    let success = false;
    handleDeskCompleteResult(
      { ok: true, data: {} },
      {
        canEsignOverride: false,
        onSuccess: () => { success = true; },
        onEsignRequired: () => {},
        onError: () => {},
      }
    );
    expect(success).toBe(true);
  });

  it('opens esign flow when unsigned and override allowed', () => {
    let esign = false;
    handleDeskCompleteResult(
      {
        ok: false,
        status: 409,
        message: 'Documentation not signed',
        data: { code: 'encounter_unsigned' },
      },
      {
        canEsignOverride: true,
        onSuccess: () => {},
        onEsignRequired: () => { esign = true; },
        onError: () => {},
      }
    );
    expect(esign).toBe(true);
  });

  it('reports error when unsigned without override', () => {
    let message = '';
    handleDeskCompleteResult(
      {
        ok: false,
        status: 409,
        message: 'Documentation not signed',
        data: { code: 'encounter_unsigned' },
      },
      {
        canEsignOverride: false,
        onSuccess: () => {},
        onEsignRequired: () => {},
        onError: (msg) => { message = msg; },
      }
    );
    expect(message).toBe('Documentation not signed');
  });
});
