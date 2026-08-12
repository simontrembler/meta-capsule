import type { FileSystemFileHandle, FileSystemPermissionState } from '../types/file-system-access';
import { db } from '../db/db';

export const ARCHIVE_HANDLE_ID = 'active-archive-zip';

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
    // User cancelled the picker
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

export async function saveArchiveHandle(handle: FileSystemFileHandle): Promise<void> {
  await db.fileHandles.put({
    id: ARCHIVE_HANDLE_ID,
    fileName: handle.name,
    handle
  });
}

export async function loadArchiveHandle(): Promise<FileSystemFileHandle | null> {
  const record = await db.fileHandles.get(ARCHIVE_HANDLE_ID);
  return record?.handle ?? null;
}

export async function clearArchiveHandle(): Promise<void> {
  await db.fileHandles.delete(ARCHIVE_HANDLE_ID);
}
