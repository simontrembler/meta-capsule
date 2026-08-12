import { ZipReader, BlobReader, BlobWriter } from '@zip.js/zip.js';

// Cache to store resolved Blob URLs: key is "zipName:relativePath", value is "blobUrl"
const blobUrlCache = new Map<string, string>();

/**
 * Extracts a specific file from the ZIP archive and returns a temporary Blob URL.
 * Uses caching to avoid extracting the same file multiple times.
 */
export async function getMediaBlobUrl(zipFile: File, relativePath: string): Promise<string> {
  // Normalize path separators (Meta exports sometimes mix / and \)
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const cacheKey = `${zipFile.name}:${normalizedPath}`;

  if (blobUrlCache.has(cacheKey)) {
    return blobUrlCache.get(cacheKey)!;
  }

  const zipReader = new ZipReader(new BlobReader(zipFile));
  try {
    const entries = await zipReader.getEntries();
    // Try exact match first, then case-insensitive, then matching end of path
    let entry = entries.find(e => e.filename === normalizedPath);
    
    if (!entry) {
      const lowerPath = normalizedPath.toLowerCase();
      entry = entries.find(e => e.filename.toLowerCase() === lowerPath);
    }

    if (!entry) {
      // Sometimes Meta JSON paths are slightly different from ZIP paths (e.g. leading slash or subfolders)
      const pathSegments = normalizedPath.split('/');
      const lastSegment = pathSegments[pathSegments.length - 1];
      entry = entries.find(e => e.filename.endsWith(lastSegment));
    }

    if (!entry) {
      throw new Error(`Fichier non trouvé dans l'archive : ${relativePath}`);
    }

    const blob = await (entry as any).getData(new BlobWriter());
    const blobUrl = URL.createObjectURL(blob);
    blobUrlCache.set(cacheKey, blobUrl);
    return blobUrl;
  } catch (error) {
    console.error(`Erreur d'extraction du média ${relativePath}:`, error);
    throw error;
  } finally {
    await zipReader.close();
  }
}

/**
 * Revokes all created Blob URLs to free up browser memory.
 * Should be called when resetting the app or loading a new archive.
 */
export function revokeAllMediaUrls() {
  for (const url of blobUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  blobUrlCache.clear();
}
