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

    return await (entry as { getData: (w: unknown) => Promise<Blob> }).getData(new BlobWriter());
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
      return await getFileByPath(root, variant);
    } catch {
      /* try next prefix */
    }
  }
  throw new Error(`Fichier non trouvé dans le dossier : ${relativePath}`);
}

function blobFromFileMap(map: Map<string, File>, relativePath: string): File {
  const normalized = normalizePath(relativePath);
  const direct = map.get(normalized);
  if (direct) return direct;

  const lower = normalized.toLowerCase();
  for (const [key, file] of map) {
    if (key.toLowerCase() === lower) return file;
  }

  for (const variant of pathVariants(normalized)) {
    const hit = map.get(variant);
    if (hit) return hit;
  }

  const lastSegment = normalized.split('/').pop();
  if (lastSegment) {
    for (const [key, file] of map) {
      if (key.endsWith(lastSegment) || file.name === lastSegment) return file;
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

  const blobUrl = URL.createObjectURL(blob);
  blobUrlCache.set(key, blobUrl);
  return blobUrl;
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
