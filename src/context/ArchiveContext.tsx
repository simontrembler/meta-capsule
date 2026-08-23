import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { db } from '../db/db';
import { fileListToPathMap, revokeAllMediaUrls, type MediaArchiveSource } from '../utils/zipMediaResolver';
import { archiveDisplayName, zipBatchDisplayName } from '../utils/archiveEntries';
import type {
  FileSystemDirectoryHandle,
  FileSystemFileHandle
} from '../types/file-system-access';
import {
  clearAllArchiveHandles,
  clearArchiveHandle,
  ensureReadPermission,
  getDroppedArchiveHandles,
  isDirectoryPickerSupported,
  isFileSystemAccessSupported,
  loadAllArchiveHandles,
  loadArchiveHandles,
  migrateLegacyArchiveHandle,
  pickDirectoryHandle,
  pickZipFileHandles,
  queryReadPermission,
  saveArchiveFileHandles,
  saveArchiveHandle,
  type ArchivePlatform,
  type LoadedArchiveHandles
} from '../utils/fileSystemAccess';
import {
  clearPersistedSession,
  persistSession,
  rebuildSessionStats,
  SESSION_STORAGE_KEY,
  type IngestionStats,
  type ZipAccessState
} from '../utils/sessionStats';

export type { ArchivePlatform, IngestionStats, ZipAccessState };
export type { MediaArchiveSource };

export type ActiveTab =
  | 'import'
  | 'dashboard'
  | 'messages'
  | 'gallery'
  | 'archives'
  | 'ads'
  | 'settings';

function guessPlatformFromZipName(name: string): ArchivePlatform | null {
  const n = name.toLowerCase();
  // Prefer Meta's official download prefixes so we never flip FB ↔ IG on weak matches
  if (n.startsWith('instagram-')) return 'instagram';
  if (n.startsWith('facebook-')) return 'facebook';
  if (/(^|[_\s/-])instagram([_\s/-]|$)/i.test(n)) return 'instagram';
  if (/(^|[_\s/-])facebook([_\s/-]|$)/i.test(n)) return 'facebook';
  return null;
}

function normalizeFileList(files: File | File[]): File[] {
  return Array.isArray(files) ? files : [files];
}

function normalizeHandleList(
  handles?: FileSystemFileHandle | FileSystemFileHandle[] | null
): FileSystemFileHandle[] {
  if (!handles) return [];
  return Array.isArray(handles) ? handles : [handles];
}

function aggregateZipAccess(
  platforms: ArchivePlatform[],
  byPlatform: Partial<Record<ArchivePlatform, ZipAccessState>>
): ZipAccessState {
  if (platforms.length === 0) return 'none';
  const states = platforms.map((p) => byPlatform[p] ?? 'unavailable');
  if (states.every((s) => s === 'ready')) return 'ready';
  if (states.some((s) => s === 'needs-permission')) return 'needs-permission';
  if (states.some((s) => s === 'ready')) return 'ready'; // partial OK for aggregate
  if (states.some((s) => s === 'unavailable')) return 'unavailable';
  return 'none';
}

type PlatformHandleStore = FileSystemDirectoryHandle | FileSystemFileHandle[];

type PendingIngest =
  | {
      kind: 'zip';
      file: File;
      handle?: FileSystemFileHandle | null;
      name: string;
    }
  | {
      kind: 'zips';
      files: File[];
      handles?: FileSystemFileHandle[];
      name: string;
    }
  | {
      kind: 'directory';
      handle: FileSystemDirectoryHandle;
      name: string;
    }
  | {
      kind: 'files';
      files: File[];
      name: string;
    };

interface ArchiveContextType {
  /** @deprecated Prefer getZipFile(platform) — primary platform ZIP */
  zipFile: File | null;
  zipAccessState: ZipAccessState;
  zipAccessByPlatform: Partial<Record<ArchivePlatform, ZipAccessState>>;
  zipFileName: string | null;
  /** ZIP File(s) per platform (multi-part Facebook batches). */
  zipFiles: Partial<Record<ArchivePlatform, File[]>>;
  zipNames: Partial<Record<ArchivePlatform, string | null>>;
  getZipFile: (platform: ArchivePlatform) => File | null;
  getArchiveSource: (platform: ArchivePlatform) => MediaArchiveSource | null;
  hasMediaAccess: (platform: ArchivePlatform) => boolean;
  supportsFileSystemAccess: boolean;
  supportsDirectoryPicker: boolean;
  isRestoringSession: boolean;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isIngesting: boolean;
  ingestionProgress: number;
  ingestionStatusText: string;
  ingestionError: string | null;
  stats: IngestionStats | null;
  startIngestion: (
    files: File | File[],
    handles?: FileSystemFileHandle | FileSystemFileHandle[] | null
  ) => void;
  startIngestionFromDirectory: (handle: FileSystemDirectoryHandle) => void;
  startIngestionFromFileList: (files: File[]) => void;
  pickAndIngestZip: () => Promise<void>;
  pickAndIngestFolder: () => Promise<void>;
  /** Add or replace a platform slot (caller should confirm replace if needed) */
  pickAndIngestForPlatform: (platform: ArchivePlatform) => Promise<void>;
  ingestFromDrop: (dataTransfer: DataTransfer) => Promise<void>;
  attachZipForMedia: (
    files: File | File[],
    handles?: FileSystemFileHandle | FileSystemFileHandle[] | null,
    platformHint?: ArchivePlatform | null
  ) => Promise<void>;
  reauthorizeZipAccess: (platform?: ArchivePlatform) => Promise<void>;
  pickZipForMedia: (platform?: ArchivePlatform) => Promise<void>;
  removePlatform: (platform: ArchivePlatform) => Promise<void>;
  resetArchive: () => Promise<void>;
  requestedConversationId: string | null;
  requestedMessageId: string | null;
  requestedMediaId: string | null;
  /** When set, gallery opens in map view (cleared by GalleryModule). */
  requestedGalleryView: 'grid' | 'map' | null;
  requestedMapFocus: { latitude: number; longitude: number; placeId?: string } | null;
  openConversation: (id: string, messageId?: string) => void;
  openMedia: (id: string) => void;
  openGalleryMap: (focus?: { latitude: number; longitude: number; placeId?: string }) => void;
  clearRequestedConversation: () => void;
  clearRequestedMedia: () => void;
  clearRequestedGalleryView: () => void;
  clearRequestedMapFocus: () => void;
}

const ArchiveContext = createContext<ArchiveContextType | undefined>(undefined);

export const ArchiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [zipFiles, setZipFiles] = useState<Partial<Record<ArchivePlatform, File[]>>>({});
  const [zipAccessByPlatform, setZipAccessByPlatform] = useState<
    Partial<Record<ArchivePlatform, ZipAccessState>>
  >({});
  const [zipNames, setZipNames] = useState<Partial<Record<ArchivePlatform, string | null>>>({});
  const [directoryHandles, setDirectoryHandles] = useState<
    Partial<Record<ArchivePlatform, FileSystemDirectoryHandle>>
  >({});
  const [folderMaps, setFolderMaps] = useState<Partial<Record<ArchivePlatform, Map<string, File>>>>(
    {}
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>('import');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionProgress, setIngestionProgress] = useState(0);
  const [ingestionStatusText, setIngestionStatusText] = useState('');
  const [ingestionError, setIngestionError] = useState<string | null>(null);
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [requestedConversationId, setRequestedConversationId] = useState<string | null>(null);
  const [requestedMessageId, setRequestedMessageId] = useState<string | null>(null);
  const [requestedMediaId, setRequestedMediaId] = useState<string | null>(null);
  const [requestedGalleryView, setRequestedGalleryView] = useState<'grid' | 'map' | null>(null);
  const [requestedMapFocus, setRequestedMapFocus] = useState<{
    latitude: number;
    longitude: number;
    placeId?: string;
  } | null>(null);
  const [supportsFileSystemAccess] = useState(() => isFileSystemAccessSupported());
  const [supportsDirectoryPicker] = useState(() => isDirectoryPickerSupported());

  const workerRef = useRef<Worker | null>(null);
  const handlesRef = useRef<Partial<Record<ArchivePlatform, PlatformHandleStore>>>({});
  const pendingIngestRef = useRef<PendingIngest | null>(null);

  const getZipFile = useCallback(
    (platform: ArchivePlatform) => zipFiles[platform]?.[0] ?? null,
    [zipFiles]
  );

  const applyZipsForPlatform = useCallback(
    (platform: ArchivePlatform, files: File[], handles?: FileSystemFileHandle[] | null) => {
      setZipFiles((prev) => ({ ...prev, [platform]: files }));
      setZipNames((prev) => ({ ...prev, [platform]: zipBatchDisplayName(files) }));
      setZipAccessByPlatform((prev) => ({ ...prev, [platform]: 'ready' }));
      setDirectoryHandles((prev) => {
        const next = { ...prev };
        delete next[platform];
        return next;
      });
      setFolderMaps((prev) => {
        const next = { ...prev };
        delete next[platform];
        return next;
      });
      if (handles && handles.length > 0) {
        handlesRef.current[platform] = handles;
      }
    },
    []
  );

  const applyDirectoryForPlatform = useCallback(
    (platform: ArchivePlatform, handle: FileSystemDirectoryHandle) => {
      setDirectoryHandles((prev) => ({ ...prev, [platform]: handle }));
      setZipNames((prev) => ({ ...prev, [platform]: handle.name }));
      setZipAccessByPlatform((prev) => ({ ...prev, [platform]: 'ready' }));
      setZipFiles((prev) => {
        const next = { ...prev };
        delete next[platform];
        return next;
      });
      setFolderMaps((prev) => {
        const next = { ...prev };
        delete next[platform];
        return next;
      });
      handlesRef.current[platform] = handle;
    },
    []
  );

  const applyFilesForPlatform = useCallback((platform: ArchivePlatform, files: File[], name: string) => {
    setFolderMaps((prev) => ({ ...prev, [platform]: fileListToPathMap(files) }));
    setZipNames((prev) => ({ ...prev, [platform]: name }));
    setZipAccessByPlatform((prev) => ({ ...prev, [platform]: 'ready' }));
    setZipFiles((prev) => {
      const next = { ...prev };
      delete next[platform];
      return next;
    });
    setDirectoryHandles((prev) => {
      const next = { ...prev };
      delete next[platform];
      return next;
    });
    delete handlesRef.current[platform];
  }, []);

  const archiveSources = useMemo(() => {
    const out: Partial<Record<ArchivePlatform, MediaArchiveSource>> = {};
    for (const platform of ['facebook', 'instagram'] as ArchivePlatform[]) {
      const zips = zipFiles[platform];
      if (zips && zips.length > 0) {
        out[platform] =
          zips.length === 1
            ? { kind: 'zip', file: zips[0] }
            : {
                kind: 'zips',
                files: zips,
                name: zipNames[platform] || zipBatchDisplayName(zips)
              };
        continue;
      }
      const dir = directoryHandles[platform];
      if (dir) {
        out[platform] = {
          kind: 'directory',
          root: dir,
          name: zipNames[platform] || dir.name
        };
        continue;
      }
      const map = folderMaps[platform];
      if (map) {
        out[platform] = { kind: 'files', map, name: zipNames[platform] || 'archive' };
      }
    }
    return out;
  }, [zipFiles, directoryHandles, folderMaps, zipNames]);

  const getArchiveSource = useCallback(
    (platform: ArchivePlatform): MediaArchiveSource | null => archiveSources[platform] ?? null,
    [archiveSources]
  );

  const hasMediaAccess = useCallback(
    (platform: ArchivePlatform) => getArchiveSource(platform) != null,
    [getArchiveSource]
  );

  // Restore session from IndexedDB + per-platform FSA handles
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        // Prefer IndexedDB as source of truth; hydrate zip names from storage
        const stored = localStorage.getItem(SESSION_STORAGE_KEY);
        const nameMap: Partial<Record<ArchivePlatform, string | null>> = {};

        if (stored) {
          try {
            const parsed = JSON.parse(stored) as {
              archives?: Partial<
                Record<ArchivePlatform, { zipFileName?: string | null; ownerName?: string }>
              >;
            };
            for (const platform of ['facebook', 'instagram'] as ArchivePlatform[]) {
              nameMap[platform] = parsed.archives?.[platform]?.zipFileName ?? null;
            }
          } catch {
            /* ignore */
          }
        } else {
          // Legacy single-archive session
          const legacyName = localStorage.getItem('meta_capsule_zip_name');
          const legacyStats = localStorage.getItem('meta_capsule_stats');
          if (legacyStats && legacyName) {
            try {
              const s = JSON.parse(legacyStats) as { platform?: ArchivePlatform };
              if (s.platform) nameMap[s.platform] = legacyName;
            } catch {
              /* ignore */
            }
          }
        }

        const rebuilt = await rebuildSessionStats(nameMap);
        if (cancelled) return;

        if (!rebuilt) {
          setIsRestoringSession(false);
          return;
        }

        setStats(rebuilt);
        setZipNames(nameMap);
        persistSession(rebuilt);
        setActiveTab('dashboard');

        const handles = await loadAllArchiveHandles();
        if (cancelled) return;

        if (Object.keys(handles).length === 0) {
          const legacy = await migrateLegacyArchiveHandle(rebuilt.platform);
          if (legacy) {
            handles[rebuilt.platform] =
              legacy.kind === 'directory'
                ? { kind: 'directory', handle: legacy as FileSystemDirectoryHandle }
                : { kind: 'files', handles: [legacy as FileSystemFileHandle] };
          }
        }

        const accessMap: Partial<Record<ArchivePlatform, ZipAccessState>> = {};
        let anyNeedsPermission = false;
        let anyUnavailable = false;

        for (const platform of rebuilt.platforms) {
          const loaded: LoadedArchiveHandles | undefined = handles[platform];
          if (!loaded) {
            accessMap[platform] = 'unavailable';
            anyUnavailable = true;
            continue;
          }

          if (loaded.kind === 'directory') {
            handlesRef.current[platform] = loaded.handle;
            const permission = await queryReadPermission(loaded.handle);

            if (permission === 'granted') {
              if (!cancelled) {
                applyDirectoryForPlatform(platform, loaded.handle);
                accessMap[platform] = 'ready';
              }
            } else if (permission === 'prompt') {
              accessMap[platform] = 'needs-permission';
              anyNeedsPermission = true;
              setZipNames((prev) => ({
                ...prev,
                [platform]: loaded.handle.name || prev[platform] || null
              }));
            } else {
              accessMap[platform] = 'unavailable';
              anyUnavailable = true;
            }
            continue;
          }

          handlesRef.current[platform] = loaded.handles;
          const permissions = await Promise.all(
            loaded.handles.map((h) => queryReadPermission(h))
          );

          if (permissions.every((p) => p === 'granted')) {
            const files: File[] = [];
            for (const handle of loaded.handles) {
              files.push(await handle.getFile());
            }
            if (!cancelled) {
              applyZipsForPlatform(platform, files, loaded.handles);
              accessMap[platform] = 'ready';
            }
          } else if (permissions.some((p) => p === 'prompt')) {
            accessMap[platform] = 'needs-permission';
            anyNeedsPermission = true;
            setZipNames((prev) => ({
              ...prev,
              [platform]:
                prev[platform] ||
                (loaded.handles.length === 1
                  ? loaded.handles[0].name
                  : `${loaded.handles.length} archives`)
            }));
          } else {
            accessMap[platform] = 'unavailable';
            anyUnavailable = true;
          }
        }

        if (!cancelled) {
          setZipAccessByPlatform((prev) => ({ ...prev, ...accessMap }));
          if (anyNeedsPermission) {
            setIngestionStatusText(
              "Archive(s) trouvée(s). Un clic suffit pour réactiver l'accès aux médias (sans réimporter)."
            );
          } else if (anyUnavailable) {
            setIngestionStatusText(
              "Données restaurées. Re-sélectionnez le ZIP ou le dossier manquant pour voir les images de cette plateforme."
            );
          } else {
            setIngestionStatusText('');
          }
        }
      } catch (error) {
        console.error('Session restore failed:', error);
      } finally {
        if (!cancelled) {
          setIsRestoringSession(false);
        }
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [applyZipsForPlatform, applyDirectoryForPlatform]);

  const launchIngestion = useCallback(
    (pending: PendingIngest, workerPayload: Record<string, unknown>) => {
      if (isIngesting) return;

      setIsIngesting(true);
      setIngestionProgress(0);
      setIngestionStatusText('Initialisation du traitement...');
      setIngestionError(null);

      pendingIngestRef.current = pending;
      const guessed = guessPlatformFromZipName(pending.name);

      if (guessed) {
        if (pending.kind === 'zip') {
          applyZipsForPlatform(
            guessed,
            [pending.file],
            pending.handle ? [pending.handle] : null
          );
          if (pending.handle) {
            void saveArchiveFileHandles(guessed, [pending.handle], pending.name).catch((err) => {
              console.warn('Unable to persist file handle:', err);
            });
          }
        } else if (pending.kind === 'zips') {
          applyZipsForPlatform(guessed, pending.files, pending.handles ?? null);
          if (pending.handles && pending.handles.length > 0) {
            void saveArchiveFileHandles(guessed, pending.handles, pending.name).catch((err) => {
              console.warn('Unable to persist file handles:', err);
            });
          }
        } else if (pending.kind === 'directory') {
          applyDirectoryForPlatform(guessed, pending.handle);
          void saveArchiveHandle(guessed, pending.handle).catch((err) => {
            console.warn('Unable to persist file handle:', err);
          });
        } else if (pending.kind === 'files') {
          applyFilesForPlatform(guessed, pending.files, pending.name);
        }
      }

      revokeAllMediaUrls();

      const worker = new Worker(
        new URL('../workers/ingestion.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      worker.onmessage = async (event) => {
        const { type, payload } = event.data;

        if (type === 'PROGRESS') {
          setIngestionProgress(payload.progress);
          setIngestionStatusText(payload.statusText);
        } else if (type === 'COMPLETE') {
          const platform = (payload.stats?.platform || guessed || 'facebook') as ArchivePlatform;
          const done = pendingIngestRef.current;

          if (done?.kind === 'directory') {
            applyDirectoryForPlatform(platform, done.handle);
            try {
              await saveArchiveHandle(platform, done.handle);
            } catch (err) {
              console.warn('Unable to persist directory handle:', err);
            }
          } else if (done?.kind === 'files') {
            applyFilesForPlatform(platform, done.files, done.name);
            await clearArchiveHandle(platform);
            delete handlesRef.current[platform];
          } else if (done?.kind === 'zips') {
            applyZipsForPlatform(platform, done.files, done.handles ?? null);
            if (done.handles && done.handles.length > 0) {
              try {
                await saveArchiveFileHandles(platform, done.handles, done.name);
              } catch (err) {
                console.warn('Unable to persist file handles:', err);
              }
            } else {
              await clearArchiveHandle(platform);
              delete handlesRef.current[platform];
            }
          } else if (done?.kind === 'zip') {
            applyZipsForPlatform(
              platform,
              [done.file],
              done.handle ? [done.handle] : null
            );
            if (done.handle) {
              try {
                await saveArchiveFileHandles(platform, [done.handle], done.name);
              } catch (err) {
                console.warn('Unable to persist file handle:', err);
              }
            } else {
              await clearArchiveHandle(platform);
              delete handlesRef.current[platform];
            }
          }

          setZipNames((prev) => {
            const next = { ...prev, [platform]: done?.name || pending.name };
            void rebuildSessionStats(next).then((rebuilt) => {
              setStats(rebuilt);
              if (rebuilt) persistSession(rebuilt);
            });
            return next;
          });

          setIsIngesting(false);
          setIngestionStatusText('');
          setActiveTab('dashboard');
          pendingIngestRef.current = null;
          worker.terminate();
          workerRef.current = null;
        } else if (type === 'ERROR') {
          setIsIngesting(false);
          setIngestionError(payload.message);
          pendingIngestRef.current = null;
          worker.terminate();
          workerRef.current = null;
        }
      };

      worker.onerror = (error) => {
        console.error('Worker error:', error);
        setIsIngesting(false);
        setIngestionError("Une erreur technique est survenue dans le worker d'ingestion.");
        pendingIngestRef.current = null;
        worker.terminate();
        workerRef.current = null;
      };

      worker.postMessage({ type: 'START', ...workerPayload });
    },
    [applyDirectoryForPlatform, applyFilesForPlatform, applyZipsForPlatform, isIngesting]
  );

  const startIngestion = useCallback(
    (
      filesInput: File | File[],
      handlesInput?: FileSystemFileHandle | FileSystemFileHandle[] | null
    ) => {
      const files = normalizeFileList(filesInput).filter((f) =>
        f.name.toLowerCase().endsWith('.zip')
      );
      if (files.length === 0) return;
      const handles = normalizeHandleList(handlesInput);
      const name = zipBatchDisplayName(files);

      if (files.length === 1) {
        launchIngestion(
          { kind: 'zip', file: files[0], handle: handles[0] ?? null, name },
          { source: 'zip', file: files[0], archiveName: name }
        );
        return;
      }

      launchIngestion(
        { kind: 'zips', files, handles, name },
        { source: 'zips', files, archiveName: name }
      );
    },
    [launchIngestion]
  );

  const startIngestionFromDirectory = useCallback(
    (handle: FileSystemDirectoryHandle) => {
      launchIngestion(
        { kind: 'directory', handle, name: handle.name },
        { source: 'directory', directoryHandle: handle, archiveName: handle.name }
      );
    },
    [launchIngestion]
  );

  const startIngestionFromFileList = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const name = archiveDisplayName(files);
      launchIngestion(
        { kind: 'files', files, name },
        { source: 'files', files, archiveName: name }
      );
    },
    [launchIngestion]
  );

  const pickAndIngestZip = useCallback(async () => {
    if (isIngesting) return;

    if (!supportsFileSystemAccess) {
      return;
    }

    try {
      const handles = await pickZipFileHandles();
      if (handles.length === 0) return;

      const files: File[] = [];
      for (const handle of handles) {
        const file = await handle.getFile();
        if (!file.name.toLowerCase().endsWith('.zip')) {
          setIngestionError('Veuillez sélectionner uniquement des archives .zip.');
          return;
        }
        files.push(file);
      }

      startIngestion(files, handles);
    } catch (error: unknown) {
      console.error('pickAndIngestZip failed:', error);
      setIngestionError(
        error instanceof Error ? error.message : "Impossible d'ouvrir le sélecteur de fichiers."
      );
    }
  }, [isIngesting, startIngestion, supportsFileSystemAccess]);

  const pickAndIngestFolder = useCallback(async () => {
    if (isIngesting) return;

    try {
      if (supportsDirectoryPicker) {
        const handle = await pickDirectoryHandle();
        if (!handle) return;
        startIngestionFromDirectory(handle);
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.multiple = true;
      input.onchange = () => {
        const files = input.files ? Array.from(input.files) : [];
        if (files.length > 0) startIngestionFromFileList(files);
      };
      input.click();
    } catch (error: unknown) {
      console.error('pickAndIngestFolder failed:', error);
      setIngestionError(
        error instanceof Error ? error.message : "Impossible d'ouvrir le sélecteur de dossier."
      );
    }
  }, [
    isIngesting,
    startIngestionFromDirectory,
    startIngestionFromFileList,
    supportsDirectoryPicker
  ]);

  const pickAndIngestForPlatform = useCallback(
    async (_platform: ArchivePlatform) => {
      if (isIngesting) return;

      try {
        if (supportsFileSystemAccess) {
          const handles = await pickZipFileHandles();
          if (handles.length === 0) return;
          const files: File[] = [];
          for (const handle of handles) {
            const file = await handle.getFile();
            if (!file.name.toLowerCase().endsWith('.zip')) {
              setIngestionError('Veuillez sélectionner uniquement des archives .zip.');
              return;
            }
            files.push(file);
          }
          startIngestion(files, handles);
          return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip,application/zip';
        input.multiple = true;
        input.onchange = () => {
          const selected = input.files ? Array.from(input.files) : [];
          const zips = selected.filter((f) => f.name.toLowerCase().endsWith('.zip'));
          if (zips.length > 0) startIngestion(zips, null);
        };
        input.click();
      } catch (error: unknown) {
        console.error('pickAndIngestForPlatform failed:', error);
        setIngestionError(
          error instanceof Error ? error.message : "Impossible d'ouvrir le sélecteur de fichiers."
        );
      }
    },
    [isIngesting, startIngestion, supportsFileSystemAccess]
  );

  const ingestFromDrop = useCallback(
    async (dataTransfer: DataTransfer) => {
      if (isIngesting) return;

      try {
        const droppedHandles = await getDroppedArchiveHandles(dataTransfer);
        const dirHandles = droppedHandles.filter(
          (h): h is FileSystemDirectoryHandle => h.kind === 'directory'
        );
        const fileHandles = droppedHandles.filter(
          (h): h is FileSystemFileHandle => h.kind === 'file'
        );

        if (dirHandles.length === 1 && fileHandles.length === 0) {
          startIngestionFromDirectory(dirHandles[0]);
          return;
        }

        if (fileHandles.length > 0) {
          const files: File[] = [];
          for (const handle of fileHandles) {
            const file = await handle.getFile();
            if (!file.name.toLowerCase().endsWith('.zip')) {
              setIngestionError('Veuillez déposer des archives .zip ou un dossier d’export Meta.');
              return;
            }
            files.push(file);
          }
          startIngestion(files, fileHandles);
          return;
        }

        const dropped = Array.from(dataTransfer.files || []);
        const hasRelative = dropped.some((f) => Boolean(f.webkitRelativePath));
        if (hasRelative && dropped.length > 0) {
          startIngestionFromFileList(dropped);
          return;
        }

        const zips = dropped.filter((f) => f.name.toLowerCase().endsWith('.zip'));
        if (zips.length > 0) {
          startIngestion(zips, null);
        } else if (dropped.length > 0) {
          setIngestionError('Veuillez déposer des archives .zip ou un dossier d’export Meta.');
        }
      } catch (error: unknown) {
        console.error('ingestFromDrop failed:', error);
        setIngestionError(
          error instanceof Error ? error.message : "Échec de l'import depuis le glisser-déposer."
        );
      }
    },
    [isIngesting, startIngestion, startIngestionFromDirectory, startIngestionFromFileList]
  );

  const attachZipForMedia = useCallback(
    async (
      filesInput: File | File[],
      handlesInput?: FileSystemFileHandle | FileSystemFileHandle[] | null,
      platformHint?: ArchivePlatform | null
    ) => {
      const files = normalizeFileList(filesInput).filter((f) =>
        f.name.toLowerCase().endsWith('.zip')
      );
      if (files.length === 0) return;
      const handles = normalizeHandleList(handlesInput);
      const label = zipBatchDisplayName(files);

      const platform =
        platformHint ||
        guessPlatformFromZipName(files[0].name) ||
        stats?.platform ||
        (stats?.platforms[0] as ArchivePlatform | undefined);

      if (!platform) {
        setIngestionError("Impossible de déterminer la plateforme de l'archive.");
        return;
      }

      revokeAllMediaUrls();
      applyZipsForPlatform(platform, files, handles.length > 0 ? handles : null);

      if (handles.length > 0) {
        await saveArchiveFileHandles(platform, handles, label);
      }

      setZipNames((prev) => {
        const next = { ...prev, [platform]: label };
        void rebuildSessionStats(next).then((rebuilt) => {
          if (rebuilt) {
            setStats(rebuilt);
            persistSession(rebuilt);
          }
        });
        return next;
      });

      setIngestionStatusText('');
    },
    [applyZipsForPlatform, stats?.platform, stats?.platforms]
  );

  const reauthorizeZipAccess = useCallback(
    async (platform?: ArchivePlatform) => {
      const targets: ArchivePlatform[] = platform
        ? [platform]
        : ((stats?.platforms || Object.keys(handlesRef.current)) as ArchivePlatform[]);

      for (const p of targets) {
        let stored = handlesRef.current[p];
        if (!stored) {
          const loaded = await loadArchiveHandles(p);
          if (!loaded) {
            setZipAccessByPlatform((prev) => ({ ...prev, [p]: 'unavailable' }));
            continue;
          }
          stored = loaded.kind === 'directory' ? loaded.handle : loaded.handles;
          handlesRef.current[p] = stored;
        }

        try {
          if (Array.isArray(stored)) {
            let allGranted = true;
            for (const handle of stored) {
              const permission = await ensureReadPermission(handle);
              if (permission !== 'granted') {
                allGranted = false;
                break;
              }
            }
            if (!allGranted) {
              setZipAccessByPlatform((prev) => ({ ...prev, [p]: 'unavailable' }));
              continue;
            }
            const files: File[] = [];
            for (const handle of stored) {
              files.push(await handle.getFile());
            }
            revokeAllMediaUrls();
            applyZipsForPlatform(p, files, stored);
          } else {
            const permission = await ensureReadPermission(stored);
            if (permission !== 'granted') {
              setZipAccessByPlatform((prev) => ({ ...prev, [p]: 'unavailable' }));
              continue;
            }
            revokeAllMediaUrls();
            applyDirectoryForPlatform(p, stored);
          }
        } catch (error) {
          console.error('reauthorizeZipAccess failed:', error);
          setZipAccessByPlatform((prev) => ({ ...prev, [p]: 'unavailable' }));
        }
      }

      setIngestionStatusText('');
    },
    [applyDirectoryForPlatform, applyZipsForPlatform, stats?.platforms]
  );

  const pickZipForMedia = useCallback(
    async (platform?: ArchivePlatform) => {
      try {
        if (supportsFileSystemAccess) {
          const handles = await pickZipFileHandles();
          if (handles.length === 0) return;
          const files: File[] = [];
          for (const handle of handles) {
            const file = await handle.getFile();
            if (!file.name.toLowerCase().endsWith('.zip')) {
              setIngestionError('Veuillez sélectionner uniquement des archives .zip.');
              return;
            }
            files.push(file);
          }
          await attachZipForMedia(files, handles, platform ?? null);
          return;
        }
      } catch (error: unknown) {
        console.error('pickZipForMedia failed:', error);
        setIngestionError(
          error instanceof Error ? error.message : "Impossible de réactiver l'accès au ZIP."
        );
      }
    },
    [attachZipForMedia, supportsFileSystemAccess]
  );

  const removePlatform = useCallback(async (platform: ArchivePlatform) => {
    await db.clearPlatformData(platform);
    await clearArchiveHandle(platform);
    delete handlesRef.current[platform];

    setZipFiles((prev) => {
      const next = { ...prev };
      delete next[platform];
      return next;
    });
    setDirectoryHandles((prev) => {
      const next = { ...prev };
      delete next[platform];
      return next;
    });
    setFolderMaps((prev) => {
      const next = { ...prev };
      delete next[platform];
      return next;
    });
    setZipAccessByPlatform((prev) => {
      const next = { ...prev };
      delete next[platform];
      return next;
    });

    revokeAllMediaUrls();

    setZipNames((prev) => {
      const next = { ...prev };
      delete next[platform];
      void rebuildSessionStats(next).then((rebuilt) => {
        setStats(rebuilt);
        if (rebuilt) {
          persistSession(rebuilt);
        } else {
          clearPersistedSession();
          setActiveTab('import');
        }
      });
      return next;
    });
  }, []);

  const openConversation = useCallback((id: string, messageId?: string) => {
    setRequestedConversationId(id);
    setRequestedMessageId(messageId ?? null);
    setActiveTab('messages');
  }, []);

  const clearRequestedConversation = useCallback(() => {
    setRequestedConversationId(null);
    setRequestedMessageId(null);
  }, []);

  const openMedia = useCallback((id: string) => {
    setRequestedMediaId(id);
    setRequestedGalleryView('grid');
    setActiveTab('gallery');
  }, []);

  const openGalleryMap = useCallback(
    (focus?: { latitude: number; longitude: number; placeId?: string }) => {
      setRequestedGalleryView('map');
      setRequestedMapFocus(focus ?? null);
      setActiveTab('gallery');
    },
    []
  );

  const clearRequestedMedia = useCallback(() => {
    setRequestedMediaId(null);
  }, []);

  const clearRequestedGalleryView = useCallback(() => {
    setRequestedGalleryView(null);
  }, []);

  const clearRequestedMapFocus = useCallback(() => {
    setRequestedMapFocus(null);
  }, []);

  const resetArchive = useCallback(async () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    setIsIngesting(false);
    setIngestionProgress(0);
    setIngestionStatusText('');
    setIngestionError(null);
    setStats(null);
    setZipFiles({});
    setZipNames({});
    setZipAccessByPlatform({});
    setDirectoryHandles({});
    setFolderMaps({});
    handlesRef.current = {};
    setRequestedConversationId(null);
    setRequestedMessageId(null);
    setRequestedMediaId(null);
    setRequestedGalleryView(null);
    setActiveTab('import');

    await db.clearAll();
    await clearAllArchiveHandles();
    clearPersistedSession();

    revokeAllMediaUrls();
  }, []);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const primaryPlatform = stats?.platform;
  const zipFile = primaryPlatform ? zipFiles[primaryPlatform]?.[0] ?? null : null;
  const zipFileName =
    (primaryPlatform && zipNames[primaryPlatform]) ||
    Object.values(zipNames).find(Boolean) ||
    null;
  const zipAccessState = aggregateZipAccess(
    stats?.platforms || (Object.keys(zipAccessByPlatform) as ArchivePlatform[]),
    zipAccessByPlatform
  );

  return (
    <ArchiveContext.Provider
      value={{
        zipFile,
        zipAccessState,
        zipAccessByPlatform,
        zipFileName,
        zipFiles,
        zipNames,
        getZipFile,
        getArchiveSource,
        hasMediaAccess,
        supportsFileSystemAccess,
        supportsDirectoryPicker,
        isRestoringSession,
        activeTab,
        setActiveTab,
        isIngesting,
        ingestionProgress,
        ingestionStatusText,
        ingestionError,
        stats,
        startIngestion,
        startIngestionFromDirectory,
        startIngestionFromFileList,
        pickAndIngestZip,
        pickAndIngestFolder,
        pickAndIngestForPlatform,
        ingestFromDrop,
        attachZipForMedia,
        reauthorizeZipAccess,
        pickZipForMedia,
        removePlatform,
        resetArchive,
        requestedConversationId,
        requestedMessageId,
        requestedMediaId,
        requestedGalleryView,
        requestedMapFocus,
        openConversation,
        openMedia,
        openGalleryMap,
        clearRequestedConversation,
        clearRequestedMedia,
        clearRequestedGalleryView,
        clearRequestedMapFocus
      }}
    >
      {children}
    </ArchiveContext.Provider>
  );
};

export const useArchive = () => {
  const context = useContext(ArchiveContext);
  if (context === undefined) {
    throw new Error('useArchive must be used within an ArchiveProvider');
  }
  return context;
};
