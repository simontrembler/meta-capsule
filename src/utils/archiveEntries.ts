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

type ZipRawEntry = {
  filename: string;
  directory?: boolean;
  lastModDate?: Date;
  uncompressedSize?: number;
  getData: (writer: unknown) => Promise<string>;
};

function mapZipEntry(entry: ZipRawEntry): ArchiveEntry & { size: number } {
  return {
    filename: normalizePath(entry.filename),
    directory: Boolean(entry.directory),
    lastModDate: entry.lastModDate,
    size: entry.uncompressedSize ?? 0,
    getText: async () => entry.getData(new TextWriter())
  };
}

export async function entriesFromZip(file: File): Promise<ArchiveEntry[]> {
  const zipReader = new ZipReader(new BlobReader(file));
  const raw = (await zipReader.getEntries()) as ZipRawEntry[];
  return raw.map((entry) => {
    const mapped = mapZipEntry(entry);
    const { size: _size, ...archiveEntry } = mapped;
    return archiveEntry;
  });
}

/**
 * Union entries from multiple ZIP parts (Facebook multi-part exports).
 * Collision policy: prefer non-empty over empty (0-byte stubs); otherwise larger size wins.
 */
export async function entriesFromZips(files: File[]): Promise<ArchiveEntry[]> {
  if (files.length === 0) return [];
  if (files.length === 1) return entriesFromZip(files[0]);

  const byPath = new Map<string, ArchiveEntry & { size: number }>();

  for (const file of files) {
    const zipReader = new ZipReader(new BlobReader(file));
    const raw = (await zipReader.getEntries()) as ZipRawEntry[];
    for (const rawEntry of raw) {
      const mapped = mapZipEntry(rawEntry);
      const key = mapped.filename.toLowerCase();
      const existing = byPath.get(key);
      if (!existing) {
        byPath.set(key, mapped);
        continue;
      }
      const preferNew =
        (mapped.size > 0 && existing.size === 0) ||
        (mapped.size > existing.size && !(existing.size > 0 && mapped.size === 0));
      if (preferNew) {
        byPath.set(key, mapped);
      }
    }
  }

  return Array.from(byPath.values()).map(({ size: _size, ...entry }) => entry);
}

/** Display label for one or many ZIP files. */
export function zipBatchDisplayName(files: File[]): string {
  if (files.length === 0) return 'archive';
  if (files.length === 1) return files[0].name;
  return `${files.length} archives · ${files[0].name}`;
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
