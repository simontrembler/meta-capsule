import type {
  FileSystemDirectoryHandle,
  FileSystemFileHandle,
  FileSystemHandle,
  FileSystemPermissionState
} from '../types/file-system-access';
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

export function isDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
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

export async function pickDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (!isDirectoryPickerSupported() || !window.showDirectoryPicker) {
    return null;
  }

  try {
    return await window.showDirectoryPicker({ mode: 'read' });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
}

export async function getDroppedArchiveHandle(
  dataTransfer: DataTransfer
): Promise<FileSystemHandle | null> {
  const item = dataTransfer.items?.[0];
  if (!item || typeof item.getAsFileSystemHandle !== 'function') {
    return null;
  }

  return (await item.getAsFileSystemHandle()) ?? null;
}

export async function queryReadPermission(
  handle: FileSystemHandle
): Promise<FileSystemPermissionState> {
  if ('queryPermission' in handle && typeof handle.queryPermission === 'function') {
    return handle.queryPermission({ mode: 'read' });
  }
  return 'granted';
}

export async function ensureReadPermission(
  handle: FileSystemHandle
): Promise<FileSystemPermissionState> {
  const current = await queryReadPermission(handle);
  if (current === 'granted') {
    return current;
  }

  if ('requestPermission' in handle && typeof handle.requestPermission === 'function') {
    return handle.requestPermission({ mode: 'read' });
  }

  return current;
}

export async function saveArchiveHandle(
  platform: ArchivePlatform,
  handle: FileSystemHandle
): Promise<void> {
  await db.fileHandles.put({
    id: archiveHandleId(platform),
    fileName: handle.name,
    kind: handle.kind,
    handle
  });
  await db.fileHandles.delete(ARCHIVE_HANDLE_ID);
}

export async function loadArchiveHandle(
  platform: ArchivePlatform
): Promise<FileSystemHandle | null> {
  const record = await db.fileHandles.get(archiveHandleId(platform));
  if (record?.handle) return record.handle;
  return null;
}

/** One-time migration from pre-multi-archive storage onto a known platform */
export async function migrateLegacyArchiveHandle(
  platform: ArchivePlatform
): Promise<FileSystemHandle | null> {
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
  Partial<Record<ArchivePlatform, FileSystemHandle>>
> {
  const result: Partial<Record<ArchivePlatform, FileSystemHandle>> = {};
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
