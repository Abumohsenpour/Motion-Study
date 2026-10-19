/** Saving files to the researcher's computer (browser download; works offline and from a file:// page). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadText(text: string, filename: string, mime = 'application/json'): void {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

/**
 * ASCII-only file name part. Some browsers/systems silently replace non-ASCII download names with "download",
 * so Persian titles fall back to the given default.
 */
export const safeFileName = (s: string, fallback = 'delphi-project'): string =>
  s
    .replace(/[^A-Za-z0-9 _.-]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-') || fallback;

/** Today as YYYY-MM-DD (for file names). */
export const stamp = (): string => new Date().toISOString().slice(0, 10);

export const readText = (f: File): Promise<string> => f.text();
