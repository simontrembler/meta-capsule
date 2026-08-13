import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../db/db';
import { revokeAllMediaUrls } from '../utils/zipMediaResolver';
import type { FileSystemFileHandle } from '../types/file-system-access';
import {
  clearAllArchiveHandles,
  clearArchiveHandle,
  ensureReadPermission,
  getFileSystemHandleFromDrop,
  isFileSystemAccessSupported,
  loadAllArchiveHandles,
  loadArchiveHandle,
  migrateLegacyArchiveHandle,
  pickZipFileHandle,
  queryReadPermission,
  saveArchiveHandle,
  type ArchivePlatform
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

function guessPlatformFromZipName(name: string): ArchivePlatform | null {
  const n = name.toLowerCase();
  // Prefer Meta's official download prefixes so we never flip FB ↔ IG on weak matches
  if (n.startsWith('instagram-')) return 'instagram';
  if (n.startsWith('facebook-')) return 'facebook';
  if (/(^|[_\s/-])instagram([_\s/-]|$)/i.test(n)) return 'instagram';
  if (/(^|[_\s/-])facebook([_\s/-]|$)/i.test(n)) return 'facebook';
  return null;
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

interface ArchiveContextType {
  /** @deprecated Prefer getZipFile(platform) — primary platform ZIP */
  zipFile: File | null;
  zipAccessState: ZipAccessState;
  zipAccessByPlatform: Partial<Record<ArchivePlatform, ZipAccessState>>;
  zipFileName: string | null;
  zipFiles: Partial<Record<ArchivePlatform, File | null>>;
  zipNames: Partial<Record<ArchivePlatform, string | null>>;
  getZipFile: (platform: ArchivePlatform) => File | null;
  supportsFileSystemAccess: boolean;
  isRestoringSession: boolean;
  activeTab: 'import' | 'dashboard' | 'messages' | 'gallery' | 'ads' | 'settings';
  setActiveTab: (tab: 'import' | 'dashboard' | 'messages' | 'gallery' | 'ads' | 'settings') => void;
  isIngesting: boolean;
  ingestionProgress: number;
  ingestionStatusText: string;
  ingestionError: string | null;
  stats: IngestionStats | null;
  startIngestion: (file: File, handle?: FileSystemFileHandle | null) => void;
  pickAndIngestZip: () => Promise<void>;
  /** Add or replace a platform slot (caller should confirm replace if needed) */
  pickAndIngestForPlatform: (platform: ArchivePlatform) => Promise<void>;
  ingestFromDrop: (dataTransfer: DataTransfer) => Promise<void>;
  attachZipForMedia: (
    file: File,
    handle?: FileSystemFileHandle | null,
    platformHint?: ArchivePlatform | null
  ) => Promise<void>;
  reauthorizeZipAccess: (platform?: ArchivePlatform) => Promise<void>;
  pickZipForMedia: (platform?: ArchivePlatform) => Promise<void>;
  removePlatform: (platform: ArchivePlatform) => Promise<void>;
  resetArchive: () => Promise<void>;
}

const ArchiveContext = createContext<ArchiveContextType | undefined>(undefined);

export const ArchiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [zipFiles, setZipFiles] = useState<Partial<Record<ArchivePlatform, File | null>>>({});
  const [zipAccessByPlatform, setZipAccessByPlatform] = useState<
    Partial<Record<ArchivePlatform, ZipAccessState>>
  >({});
  const [zipNames, setZipNames] = useState<Partial<Record<ArchivePlatform, string | null>>>({});
  const [activeTab, setActiveTab] = useState<
    'import' | 'dashboard' | 'messages' | 'gallery' | 'ads' | 'settings'
  >('import');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionProgress, setIngestionProgress] = useState(0);
  const [ingestionStatusText, setIngestionStatusText] = useState('');
  const [ingestionError, setIngestionError] = useState<string | null>(null);
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [supportsFileSystemAccess] = useState(() => isFileSystemAccessSupported());

  const workerRef = useRef<Worker | null>(null);
  const handlesRef = useRef<Partial<Record<ArchivePlatform, FileSystemFileHandle>>>({});
  const pendingIngestRef = useRef<{
    file: File;
    handle: FileSystemFileHandle | null;
  } | null>(null);

  const getZipFile = useCallback(
    (platform: ArchivePlatform) => zipFiles[platform] ?? null,
    [zipFiles]
  );

  const applyZipForPlatform = useCallback(
    (platform: ArchivePlatform, file: File, handle?: FileSystemFileHandle | null) => {
      setZipFiles((prev) => ({ ...prev, [platform]: file }));
      setZipNames((prev) => ({ ...prev, [platform]: file.name }));
      setZipAccessByPlatform((prev) => ({ ...prev, [platform]: 'ready' }));
      if (handle) {
        handlesRef.current[platform] = handle;
      }
    },
    []
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
          if (legacy) handles[rebuilt.platform] = legacy;
        }

        const accessMap: Partial<Record<ArchivePlatform, ZipAccessState>> = {};
        let anyNeedsPermission = false;
        let anyUnavailable = false;

        for (const platform of rebuilt.platforms) {
          const handle = handles[platform];
          if (!handle) {
            accessMap[platform] = 'unavailable';
            anyUnavailable = true;
            continue;
          }

          handlesRef.current[platform] = handle;
          const permission = await queryReadPermission(handle);

          if (permission === 'granted') {
            const file = await handle.getFile();
            if (!cancelled) {
              applyZipForPlatform(platform, file, handle);
              accessMap[platform] = 'ready';
            }
          } else if (permission === 'prompt') {
            accessMap[platform] = 'needs-permission';
            anyNeedsPermission = true;
            setZipNames((prev) => ({
              ...prev,
              [platform]: handle.name || prev[platform] || null
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
              "Données restaurées. Re-sélectionnez le ZIP manquant pour voir les images de cette plateforme."
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
  }, [applyZipForPlatform]);

  const startIngestion = useCallback(
    (file: File, handle?: FileSystemFileHandle | null) => {
      if (isIngesting) return;

      // Keep existing stats so the shell stays open while adding a second archive
      setIsIngesting(true);
      setIngestionProgress(0);
      setIngestionStatusText('Initialisation du traitement...');
      setIngestionError(null);

      pendingIngestRef.current = { file, handle: handle ?? null };

      const guessed = guessPlatformFromZipName(file.name);
      if (guessed) {
        applyZipForPlatform(guessed, file, handle ?? null);
        if (handle) {
          void saveArchiveHandle(guessed, handle).catch((err) => {
            console.warn('Unable to persist file handle:', err);
          });
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
          const pending = pendingIngestRef.current;

          applyZipForPlatform(platform, pending?.file || file, pending?.handle ?? null);

          if (pending?.handle) {
            try {
              await saveArchiveHandle(platform, pending.handle);
            } catch (err) {
              console.warn('Unable to persist file handle:', err);
            }
          } else if (!pending?.handle) {
            await clearArchiveHandle(platform);
            delete handlesRef.current[platform];
          }

          setZipNames((prev) => {
            const next = { ...prev, [platform]: (pending?.file || file).name };
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

      worker.postMessage({ type: 'START', file });
    },
    [applyZipForPlatform, isIngesting]
  );

  const pickAndIngestZip = useCallback(async () => {
    if (isIngesting) return;

    if (!supportsFileSystemAccess) {
      return;
    }

    try {
      const handle = await pickZipFileHandle();
      if (!handle) return;

      const file = await handle.getFile();
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setIngestionError('Veuillez sélectionner une archive .zip.');
        return;
      }

      startIngestion(file, handle);
    } catch (error: unknown) {
      console.error('pickAndIngestZip failed:', error);
      setIngestionError(
        error instanceof Error ? error.message : "Impossible d'ouvrir le sélecteur de fichiers."
      );
    }
  }, [isIngesting, startIngestion, supportsFileSystemAccess]);

  const pickAndIngestForPlatform = useCallback(
    async (_platform: ArchivePlatform) => {
      if (isIngesting) return;

      try {
        if (supportsFileSystemAccess) {
          const handle = await pickZipFileHandle();
          if (!handle) return;
          const file = await handle.getFile();
          if (!file.name.toLowerCase().endsWith('.zip')) {
            setIngestionError('Veuillez sélectionner une archive .zip.');
            return;
          }
          startIngestion(file, handle);
          return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip,application/zip';
        input.onchange = () => {
          const file = input.files?.[0];
          if (file?.name.toLowerCase().endsWith('.zip')) {
            startIngestion(file, null);
          }
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
        const handle = await getFileSystemHandleFromDrop(dataTransfer);
        if (handle) {
          const file = await handle.getFile();
          if (!file.name.toLowerCase().endsWith('.zip')) {
            setIngestionError('Veuillez déposer une archive .zip.');
            return;
          }
          startIngestion(file, handle);
          return;
        }

        const file = dataTransfer.files?.[0];
        if (file && file.name.toLowerCase().endsWith('.zip')) {
          startIngestion(file, null);
        }
      } catch (error: unknown) {
        console.error('ingestFromDrop failed:', error);
        setIngestionError(
          error instanceof Error ? error.message : "Échec de l'import depuis le glisser-déposer."
        );
      }
    },
    [isIngesting, startIngestion]
  );

  const attachZipForMedia = useCallback(
    async (
      file: File,
      handle?: FileSystemFileHandle | null,
      platformHint?: ArchivePlatform | null
    ) => {
      const platform =
        platformHint ||
        guessPlatformFromZipName(file.name) ||
        stats?.platform ||
        (stats?.platforms[0] as ArchivePlatform | undefined);

      if (!platform) {
        setIngestionError("Impossible de déterminer la plateforme de l'archive.");
        return;
      }

      revokeAllMediaUrls();
      applyZipForPlatform(platform, file, handle ?? null);

      if (handle) {
        await saveArchiveHandle(platform, handle);
      }

      setZipNames((prev) => {
        const next = { ...prev, [platform]: file.name };
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
    [applyZipForPlatform, stats?.platform, stats?.platforms]
  );

  const reauthorizeZipAccess = useCallback(
    async (platform?: ArchivePlatform) => {
      const targets: ArchivePlatform[] = platform
        ? [platform]
        : ((stats?.platforms || Object.keys(handlesRef.current)) as ArchivePlatform[]);

      for (const p of targets) {
        const handle = handlesRef.current[p] ?? (await loadArchiveHandle(p));
        if (!handle) {
          setZipAccessByPlatform((prev) => ({ ...prev, [p]: 'unavailable' }));
          continue;
        }

        handlesRef.current[p] = handle;

        try {
          const permission = await ensureReadPermission(handle);
          if (permission !== 'granted') {
            setZipAccessByPlatform((prev) => ({ ...prev, [p]: 'unavailable' }));
            continue;
          }

          const file = await handle.getFile();
          revokeAllMediaUrls();
          applyZipForPlatform(p, file, handle);
        } catch (error) {
          console.error('reauthorizeZipAccess failed:', error);
          setZipAccessByPlatform((prev) => ({ ...prev, [p]: 'unavailable' }));
        }
      }

      setIngestionStatusText('');
    },
    [applyZipForPlatform, stats?.platforms]
  );

  const pickZipForMedia = useCallback(
    async (platform?: ArchivePlatform) => {
      try {
        if (supportsFileSystemAccess) {
          const handle = await pickZipFileHandle();
          if (!handle) return;
          const file = await handle.getFile();
          if (!file.name.toLowerCase().endsWith('.zip')) {
            setIngestionError('Veuillez sélectionner une archive .zip.');
            return;
          }
          await attachZipForMedia(file, handle, platform ?? null);
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
    handlesRef.current = {};
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
  const zipFile = primaryPlatform ? zipFiles[primaryPlatform] ?? null : null;
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
        supportsFileSystemAccess,
        isRestoringSession,
        activeTab,
        setActiveTab,
        isIngesting,
        ingestionProgress,
        ingestionStatusText,
        ingestionError,
        stats,
        startIngestion,
        pickAndIngestZip,
        pickAndIngestForPlatform,
        ingestFromDrop,
        attachZipForMedia,
        reauthorizeZipAccess,
        pickZipForMedia,
        removePlatform,
        resetArchive
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
