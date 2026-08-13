import { ZipReader, BlobReader, TextWriter, configure } from '@zip.js/zip.js';
import type { FileSystemDirectoryHandle } from '../types/file-system-access';

configure({ useWebWorkers: false });

export type ArchiveEntry = {
  filename: string;
  directory: boolean;
  lastModDate?: Date;
  getText: () => Promise<string>;
};

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

export async function entriesFromZip(file: File): Promise<ArchiveEntry[]> {
  const zipReader = new ZipReader(new BlobReader(file));
  const raw = await zipReader.getEntries();
  return raw.map((entry) => ({
    filename: normalizePath(entry.filename),
    directory: Boolean(entry.directory),
    lastModDate: entry.lastModDate,
    getText: async () => {
      const typed = entry as { getData: (writer: unknown) => Promise<string> };
      return typed.getData(new TextWriter());
    }
  }));
}

export async function entriesFromDirectory(
  root: FileSystemDirectoryHandle
): Promise<ArchiveEntry[]> {
  const out: ArchiveEntry[] = [];
  await walkDirectory(root, '', out);
  return out;
}

async function walkDirectory(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: ArchiveEntry[]
): Promise<void> {
  for await (const [name, handle] of dir.entries()) {
    if (name === '.DS_Store') continue;
    const filename = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'directory') {
      out.push({
        filename: `${filename}/`,
        directory: true,
        getText: async () => ''
      });
      await walkDirectory(handle, filename, out);
    } else {
      const fileHandle = handle;
      out.push({
        filename,
        directory: false,
        getText: async () => {
          const file = await fileHandle.getFile();
          return file.text();
        }
      });
    }
  }
}

export function entriesFromFileList(files: File[]): ArchiveEntry[] {
  return files
    .filter((file) => file.name !== '.DS_Store' && !file.name.startsWith('._'))
    .map((file) => ({
      filename: normalizePath(file.webkitRelativePath || file.name),
      directory: false,
      lastModDate: new Date(file.lastModified),
      getText: () => file.text()
    }));
}

export function archiveDisplayName(files: File[]): string {
  const first = files[0]?.webkitRelativePath || files[0]?.name || 'archive';
  const top = first.split(/[/\\]/)[0];
  return top || 'archive';
}
