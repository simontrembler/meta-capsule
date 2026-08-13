import { ZipReader, BlobReader, BlobWriter } from '@zip.js/zip.js';
import type { FileSystemDirectoryHandle } from '../types/file-system-access';

export type MediaArchiveSource =
  | { kind: 'zip'; file: File }
  | { kind: 'directory'; root: FileSystemDirectoryHandle; name: string }
  | { kind: 'files'; map: Map<string, File>; name: string };

const blobUrlCache = new Map<string, string>();

function normalizePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\//, '');
}

function mimeFromPath(relativePath: string): string {
  const ext = relativePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'mp4':
    case 'm4v':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'mp3':
      return 'audio/mpeg';
    case 'm4a':
      return 'audio/mp4';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'aac':
      return 'audio/aac';
    default:
      return 'application/octet-stream';
  }
}

function withMimeType(blob: Blob, relativePath: string): Blob {
  const mime = mimeFromPath(relativePath);
  if (mime === 'application/octet-stream') return blob;
  if (blob.type && blob.type !== 'application/octet-stream' && blob.type !== '') {
    return blob;
  }
  return blob.slice(0, blob.size, mime);
}

function cacheKey(source: MediaArchiveSource, path: string): string {
  const name =
    source.kind === 'zip' ? source.file.name : source.name;
  return `${source.kind}:${name}:${path}`;
}

function pathVariants(relativePath: string): string[] {
  const normalized = normalizePath(relativePath);
  const parts = normalized.split('/').filter(Boolean);
  const variants = [normalized];
  for (let i = 1; i < parts.length; i += 1) {
    variants.push(parts.slice(i).join('/'));
  }
  return variants;
}

async function getFileByPath(
  root: FileSystemDirectoryHandle,
  relativePath: string
): Promise<File> {
  const parts = normalizePath(relativePath).split('/').filter(Boolean);
  let current: FileSystemDirectoryHandle = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    current = await current.getDirectoryHandle(parts[i]);
  }
  const fileHandle = await current.getFileHandle(parts[parts.length - 1]);
  return fileHandle.getFile();
}

async function blobFromZip(file: File, relativePath: string): Promise<Blob> {
  const normalizedPath = normalizePath(relativePath);
  const zipReader = new ZipReader(new BlobReader(file));
  try {
    const entries = await zipReader.getEntries();
    let entry = entries.find((e) => e.filename === normalizedPath);

    if (!entry) {
      const lowerPath = normalizedPath.toLowerCase();
      entry = entries.find((e) => e.filename.toLowerCase() === lowerPath);
    }

    if (!entry) {
      const lastSegment = normalizedPath.split('/').pop();
      if (lastSegment) {
        entry = entries.find((e) => e.filename.endsWith(lastSegment));
      }
    }

    if (!entry) {
      throw new Error(`Fichier non trouvé dans l'archive : ${relativePath}`);
    }

    const raw = await (entry as { getData: (w: unknown) => Promise<Blob> }).getData(
      new BlobWriter(mimeFromPath(normalizedPath))
    );
    return withMimeType(raw, normalizedPath);
  } finally {
    await zipReader.close();
  }
}

async function blobFromDirectory(
  root: FileSystemDirectoryHandle,
  relativePath: string
): Promise<Blob> {
  for (const variant of pathVariants(relativePath)) {
    try {
      const file = await getFileByPath(root, variant);
      return withMimeType(file, relativePath);
    } catch {
      /* try next prefix */
    }
  }
  throw new Error(`Fichier non trouvé dans le dossier : ${relativePath}`);
}

function blobFromFileMap(map: Map<string, File>, relativePath: string): Blob {
  const normalized = normalizePath(relativePath);
  const direct = map.get(normalized);
  if (direct) return withMimeType(direct, relativePath);

  const lower = normalized.toLowerCase();
  for (const [key, file] of map) {
    if (key.toLowerCase() === lower) return withMimeType(file, relativePath);
  }

  for (const variant of pathVariants(normalized)) {
    const hit = map.get(variant);
    if (hit) return withMimeType(hit, relativePath);
  }

  const lastSegment = normalized.split('/').pop();
  if (lastSegment) {
    for (const [key, file] of map) {
      if (key.endsWith(lastSegment) || file.name === lastSegment) {
        return withMimeType(file, relativePath);
      }
    }
  }

  throw new Error(`Fichier non trouvé dans le dossier : ${relativePath}`);
}

export async function getMediaBlobUrl(
  source: MediaArchiveSource | File | null | undefined,
  relativePath: string
): Promise<string> {
  if (!source) {
    throw new Error('Aucune archive média');
  }

  const resolved: MediaArchiveSource =
    source instanceof File ? { kind: 'zip', file: source } : source;
  const normalizedPath = normalizePath(relativePath);
  const key = cacheKey(resolved, normalizedPath);

  if (blobUrlCache.has(key)) {
    return blobUrlCache.get(key)!;
  }

  let blob: Blob;
  if (resolved.kind === 'zip') {
    blob = await blobFromZip(resolved.file, normalizedPath);
  } else if (resolved.kind === 'directory') {
    blob = await blobFromDirectory(resolved.root, normalizedPath);
  } else {
    blob = blobFromFileMap(resolved.map, normalizedPath);
  }
  blob = withMimeType(blob, normalizedPath);

  const blobUrl = URL.createObjectURL(blob);
  blobUrlCache.set(key, blobUrl);
  return blobUrl;
}

export async function getMediaBlob(
  source: MediaArchiveSource | File | null | undefined,
  relativePath: string
): Promise<Blob> {
  const url = await getMediaBlobUrl(source, relativePath);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Impossible de lire le média');
  }
  return response.blob();
}

export function revokeAllMediaUrls() {
  for (const url of blobUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  blobUrlCache.clear();
}

export function fileListToPathMap(files: File[]): Map<string, File> {
  const map = new Map<string, File>();
  for (const file of files) {
    const path = normalizePath(file.webkitRelativePath || file.name);
    map.set(path, file);
  }
  return map;
}
