export function hueFromSeed(seed) {
  let hash = 0;
  const text = String(seed);
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
