import { describe, expect, it, beforeEach } from 'vitest';
import {
  readCommHubSelection,
  writeCommHubSelection,
} from './commHubSessionStorage';

describe('commHubSessionStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns null when nothing stored', () => {
    expect(readCommHubSelection()).toBeNull();
  });

  it('round-trips a valid selection', () => {
    writeCommHubSelection({ lens: 'messages', selectedId: 5, selectedType: 'message' });
    expect(readCommHubSelection()).toEqual({
      lens: 'messages',
      selectedId: 5,
      selectedType: 'message',
    });
  });

  it('clears invalid stored payloads', () => {
    sessionStorage.setItem('nc_comm_hub_selection', '{"bad":true}');
    expect(readCommHubSelection()).toBeNull();
  });
});
