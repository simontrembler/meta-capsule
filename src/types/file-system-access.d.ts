/** Minimal File System Access API typings (Chromium). */

export type FileSystemPermissionMode = 'read' | 'readwrite';

export type FileSystemPermissionState = 'granted' | 'denied' | 'prompt';

export interface FileSystemHandlePermissionDescriptor {
  mode?: FileSystemPermissionMode;
}

export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

export interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<FileSystemPermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<FileSystemPermissionState>;
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  entries(): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>;
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<FileSystemPermissionState>;
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<FileSystemPermissionState>;
}

export interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
    showDirectoryPicker?: (options?: { mode?: FileSystemPermissionMode }) => Promise<FileSystemDirectoryHandle>;
  }

  interface DataTransferItem {
    getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
  }

  interface File {
    webkitRelativePath?: string;
  }

  interface HTMLInputElement {
    webkitdirectory?: boolean;
  }
}

export {};
