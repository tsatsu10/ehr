/**
 * Stable avatar tint for a conversation, hashed from the name so the same
 * person is always the same colour (premium-inbox convention). Palette mirrors
 * the scheduling provider/visit-type accents — no new tokens.
 */
const AVATAR_PALETTE = [
  '#0071e3', // blue
  '#2bb350', // green
  '#bf5af2', // purple
  '#ff6a00', // orange
  '#2fb8cf', // teal
  '#ff2d92', // pink
  '#a2845e', // brown
  '#8e8e93', // grey
] as const;

export function avatarColor(name: string): string {
  const key = (name || '').trim();
  if (key === '') {
    return AVATAR_PALETTE[AVATAR_PALETTE.length - 1];
  }
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
