import type { FileSystemFileHandle, FileSystemPermissionState } from '../types/file-system-access';
import { db } from '../db/db';

export type ArchivePlatform = 'facebook' | 'instagram';

/** Legacy single-handle id (migrated on load) */
export const ARCHIVE_HANDLE_ID = 'active-archive-zip';

export function archiveHandleId(platform: ArchivePlatform): string {
  return `archive-zip-${platform}`;
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
}

export async function pickZipFileHandle(): Promise<FileSystemFileHandle | null> {
  if (!isFileSystemAccessSupported() || !window.showOpenFilePicker) {
    return null;
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      excludeAcceptAllOption: true,
      types: [
        {
          description: 'Archive Meta (.zip)',
          accept: {
            'application/zip': ['.zip'],
            'application/x-zip-compressed': ['.zip']
          }
        }
      ]
    });
    return handle;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
}

export async function getFileSystemHandleFromDrop(
  dataTransfer: DataTransfer
): Promise<FileSystemFileHandle | null> {
  const item = dataTransfer.items?.[0];
  if (!item || typeof item.getAsFileSystemHandle !== 'function') {
    return null;
  }

  const handle = await item.getAsFileSystemHandle();
  if (!handle || handle.kind !== 'file') {
    return null;
  }

  return handle as FileSystemFileHandle;
}

export async function queryReadPermission(
  handle: FileSystemFileHandle
): Promise<FileSystemPermissionState> {
  if (typeof handle.queryPermission === 'function') {
    return handle.queryPermission({ mode: 'read' });
  }
  return 'granted';
}

export async function ensureReadPermission(
  handle: FileSystemFileHandle
): Promise<FileSystemPermissionState> {
  const current = await queryReadPermission(handle);
  if (current === 'granted') {
    return current;
  }

  if (typeof handle.requestPermission === 'function') {
    return handle.requestPermission({ mode: 'read' });
  }

  return current;
}

export async function saveArchiveHandle(
  platform: ArchivePlatform,
  handle: FileSystemFileHandle
): Promise<void> {
  await db.fileHandles.put({
    id: archiveHandleId(platform),
    fileName: handle.name,
    handle
  });
  // Drop legacy single-handle slot if present
  await db.fileHandles.delete(ARCHIVE_HANDLE_ID);
}

export async function loadArchiveHandle(
  platform: ArchivePlatform
): Promise<FileSystemFileHandle | null> {
  const record = await db.fileHandles.get(archiveHandleId(platform));
  if (record?.handle) return record.handle;
  return null;
}

/** One-time migration from pre-multi-archive storage onto a known platform */
export async function migrateLegacyArchiveHandle(
  platform: ArchivePlatform
): Promise<FileSystemFileHandle | null> {
  const existing = await loadArchiveHandle(platform);
  if (existing) return existing;

  const legacy = await db.fileHandles.get(ARCHIVE_HANDLE_ID);
  if (!legacy?.handle) return null;

  await db.fileHandles.put({
    id: archiveHandleId(platform),
    fileName: legacy.fileName,
    handle: legacy.handle
  });
  await db.fileHandles.delete(ARCHIVE_HANDLE_ID);
  return legacy.handle;
}

export async function loadAllArchiveHandles(): Promise<
  Partial<Record<ArchivePlatform, FileSystemFileHandle>>
> {
  const result: Partial<Record<ArchivePlatform, FileSystemFileHandle>> = {};
  for (const platform of ['facebook', 'instagram'] as ArchivePlatform[]) {
    const handle = await loadArchiveHandle(platform);
    if (handle) result[platform] = handle;
  }
  return result;
}

export async function clearArchiveHandle(platform: ArchivePlatform): Promise<void> {
  await db.fileHandles.delete(archiveHandleId(platform));
}

export async function clearAllArchiveHandles(): Promise<void> {
  await Promise.all([
    db.fileHandles.delete(ARCHIVE_HANDLE_ID),
    db.fileHandles.delete(archiveHandleId('facebook')),
    db.fileHandles.delete(archiveHandleId('instagram'))
  ]);
}
