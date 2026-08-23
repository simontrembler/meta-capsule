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

export type LoadedArchiveHandles =
  | { kind: 'directory'; handle: FileSystemDirectoryHandle }
  | { kind: 'files'; handles: FileSystemFileHandle[] };

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
}

export function isDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

const ZIP_PICKER_TYPES = [
  {
    description: 'Archive Meta (.zip)',
    accept: {
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip']
    }
  }
];

/** @deprecated Prefer pickZipFileHandles — kept for single-file call sites */
export async function pickZipFileHandle(): Promise<FileSystemFileHandle | null> {
  const handles = await pickZipFileHandles();
  return handles[0] ?? null;
}

export async function pickZipFileHandles(): Promise<FileSystemFileHandle[]> {
  if (!isFileSystemAccessSupported() || !window.showOpenFilePicker) {
    return [];
  }

  try {
    return await window.showOpenFilePicker({
      multiple: true,
      excludeAcceptAllOption: true,
      types: ZIP_PICKER_TYPES
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return [];
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

/** @deprecated Prefer getDroppedArchiveHandles */
export async function getDroppedArchiveHandle(
  dataTransfer: DataTransfer
): Promise<FileSystemHandle | null> {
  const handles = await getDroppedArchiveHandles(dataTransfer);
  return handles[0] ?? null;
}

export async function getDroppedArchiveHandles(
  dataTransfer: DataTransfer
): Promise<FileSystemHandle[]> {
  const items = dataTransfer.items;
  if (!items?.length) return [];

  const handles: FileSystemHandle[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item || typeof item.getAsFileSystemHandle !== 'function') continue;
    try {
      const handle = await item.getAsFileSystemHandle();
      if (handle) handles.push(handle);
    } catch {
      /* ignore items that cannot expose a handle */
    }
  }
  return handles;
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

export async function saveArchiveFileHandles(
  platform: ArchivePlatform,
  handles: FileSystemFileHandle[],
  displayName?: string
): Promise<void> {
  if (handles.length === 0) {
    await clearArchiveHandle(platform);
    return;
  }

  await db.fileHandles.put({
    id: archiveHandleId(platform),
    fileName: displayName || (handles.length === 1 ? handles[0].name : `${handles.length} archives`),
    kind: 'file',
    handle: handles[0],
    handles: handles.length > 1 ? handles : undefined
  });
  await db.fileHandles.delete(ARCHIVE_HANDLE_ID);
}

export async function loadArchiveHandle(
  platform: ArchivePlatform
): Promise<FileSystemHandle | null> {
  const loaded = await loadArchiveHandles(platform);
  if (!loaded) return null;
  if (loaded.kind === 'directory') return loaded.handle;
  return loaded.handles[0] ?? null;
}

export async function loadArchiveHandles(
  platform: ArchivePlatform
): Promise<LoadedArchiveHandles | null> {
  const record = await db.fileHandles.get(archiveHandleId(platform));
  if (!record?.handle) return null;

  if (record.kind === 'directory' || record.handle.kind === 'directory') {
    return { kind: 'directory', handle: record.handle as FileSystemDirectoryHandle };
  }

  const handles =
    record.handles && record.handles.length > 0
      ? record.handles
      : [record.handle as FileSystemFileHandle];
  return { kind: 'files', handles };
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
    kind: legacy.handle.kind,
    handle: legacy.handle,
    handles: legacy.handles
  });
  await db.fileHandles.delete(ARCHIVE_HANDLE_ID);
  return legacy.handle;
}

export async function loadAllArchiveHandles(): Promise<
  Partial<Record<ArchivePlatform, LoadedArchiveHandles>>
> {
  const result: Partial<Record<ArchivePlatform, LoadedArchiveHandles>> = {};
  for (const platform of ['facebook', 'instagram'] as ArchivePlatform[]) {
    const loaded = await loadArchiveHandles(platform);
    if (loaded) result[platform] = loaded;
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
