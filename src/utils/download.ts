export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  triggerDownloadFromUrl(url, filename);
  URL.revokeObjectURL(url);
}

export function triggerDownloadFromUrl(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function filenameFromPath(relativePath: string, fallback = 'media'): string {
  const last = relativePath.replace(/\\/g, '/').split('/').pop();
  return last && last.trim() ? last : fallback;
}
