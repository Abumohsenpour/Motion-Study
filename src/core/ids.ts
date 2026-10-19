/** Short random identifiers for project records (never shown to experts). */
export function newId(prefix = ''): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
}
