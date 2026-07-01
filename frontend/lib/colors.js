// Deterministic color hashing — same username always gets the same color,
// matches the algorithm used for avatars and room accent colors.

export const AVATAR_PALETTE = ['#8b5cf6', '#22d3ee', '#f472b6', '#60a5fa', '#34d399', '#fb923c'];

export function colorForName(name) {
  if (!name) return AVATAR_PALETTE[0];
  let total = 0;
  for (let i = 0; i < name.length; i++) total += name.charCodeAt(i);
  return AVATAR_PALETTE[total % AVATAR_PALETTE.length];
}
