import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../db/db';
import { revokeAllMediaUrls } from '../utils/zipMediaResolver';
import type { FileSystemFileHandle } from '../types/file-system-access';
import {
  clearArchiveHandle,
  ensureReadPermission,
  getFileSystemHandleFromDrop,
  isFileSystemAccessSupported,
  loadArchiveHandle,
  pickZipFileHandle,
  queryReadPermission,
  saveArchiveHandle
} from '../utils/fileSystemAccess';

interface IngestionStats {
  messagesCount: number;
  mediaCount: number;
  postsCount: number;
  platform: 'facebook' | 'instagram';
  ownerName: string;
}

/** ZIP media access after refresh / boot */
export type ZipAccessState = 'ready' | 'needs-permission' | 'unavailable' | 'none';

interface ArchiveContextType {
  zipFile: File | null;
  zipAccessState: ZipAccessState;
  zipFileName: string | null;
  supportsFileSystemAccess: boolean;
  isRestoringSession: boolean;
  activeTab: 'import' | 'dashboard' | 'messages' | 'gallery' | 'ads' | 'settings';
  setActiveTab: (tab: 'import' | 'dashboard' | 'messages' | 'gallery' | 'ads' | 'settings') => void;
  isIngesting: boolean;
  ingestionProgress: number;
  ingestionStatusText: string;
  ingestionError: string | null;
  stats: IngestionStats | null;
  /** Ingest a File; optionally persist an FSA handle for refresh survival */
  startIngestion: (file: File, handle?: FileSystemFileHandle | null) => void;
  /** Preferred picker when FSA is available (persists handle) */
  pickAndIngestZip: () => Promise<void>;
  /** Drag & drop entry (tries FSA handle from DataTransfer first) */
  ingestFromDrop: (dataTransfer: DataTransfer) => Promise<void>;
  /** Attach ZIP for media only — no re-parse (session fallback) */
  attachZipForMedia: (file: File, handle?: FileSystemFileHandle | null) => Promise<void>;
  /** User gesture: re-request read permission on stored handle */
  reauthorizeZipAccess: () => Promise<void>;
  /** Header / settings fallback picker without full re-ingest when possible */
  pickZipForMedia: () => Promise<void>;
  resetArchive: () => Promise<void>;
}

const ArchiveContext = createContext<ArchiveContextType | undefined>(undefined);

export const ArchiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipAccessState, setZipAccessState] = useState<ZipAccessState>('none');
  const [zipFileName, setZipFileName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'import' | 'dashboard' | 'messages' | 'gallery' | 'ads' | 'settings'>('import');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionProgress, setIngestionProgress] = useState(0);
  const [ingestionStatusText, setIngestionStatusText] = useState('');
  const [ingestionError, setIngestionError] = useState<string | null>(null);
  const [stats, setStats] = useState<IngestionStats | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [supportsFileSystemAccess] = useState(() => isFileSystemAccessSupported());

  const workerRef = useRef<Worker | null>(null);
  const handleRef = useRef<FileSystemFileHandle | null>(null);

  const applyZipFile = useCallback((file: File, handle?: FileSystemFileHandle | null) => {
    setZipFile(file);
    setZipFileName(file.name);
    setZipAccessState('ready');
    if (handle) {
      handleRef.current = handle;
    }
  }, []);

  // Restore session from IndexedDB + optional FSA handle (no re-ingestion)
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const savedStats = localStorage.getItem('meta_capsule_stats');
        const savedZipName = localStorage.getItem('meta_capsule_zip_name');

        if (!savedStats || !savedZipName) {
          if (!cancelled) {
            setIsRestoringSession(false);
          }
          return;
        }

        if (!cancelled) {
          setStats(JSON.parse(savedStats) as IngestionStats);
          setZipFileName(savedZipName);
          setActiveTab('dashboard');
        }

        const handle = await loadArchiveHandle();
        if (cancelled) return;

        if (!handle) {
          setZipAccessState('unavailable');
          setIngestionStatusText(
            "Données restaurées depuis la base locale. Pour voir les images, veuillez re-sélectionner l'archive."
          );
          return;
        }

        handleRef.current = handle;
        const permission = await queryReadPermission(handle);

        if (permission === 'granted') {
          const file = await handle.getFile();
          if (!cancelled) {
            applyZipFile(file, handle);
            setIngestionStatusText('');
          }
        } else if (permission === 'prompt') {
          setZipAccessState('needs-permission');
          setIngestionStatusText(
            "Archive trouvée. Un clic suffit pour réactiver l'accès aux médias (sans réimporter)."
          );
        } else {
          setZipAccessState('unavailable');
          setIngestionStatusText(
            "Permission refusée pour l'archive. Re-sélectionnez le fichier ZIP pour voir les médias."
          );
        }
      } catch (error) {
        console.error('Session restore failed:', error);
        if (!cancelled) {
          setZipAccessState('unavailable');
        }
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
  }, [applyZipFile]);

  const startIngestion = useCallback((file: File, handle?: FileSystemFileHandle | null) => {
    if (isIngesting) return;

    applyZipFile(file, handle ?? null);
    setIsIngesting(true);
    setIngestionProgress(0);
    setIngestionStatusText('Initialisation du traitement...');
    setIngestionError(null);
    setStats(null);

    revokeAllMediaUrls();

    if (handle) {
      void saveArchiveHandle(handle).catch((err) => {
        console.warn('Unable to persist file handle:', err);
      });
    } else {
      void clearArchiveHandle();
      handleRef.current = null;
    }

    const worker = new Worker(
      new URL('../workers/ingestion.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, payload } = event.data;

      if (type === 'PROGRESS') {
        setIngestionProgress(payload.progress);
        setIngestionStatusText(payload.statusText);
      } else if (type === 'COMPLETE') {
        setIsIngesting(false);
        setStats(payload.stats);

        localStorage.setItem('meta_capsule_stats', JSON.stringify(payload.stats));
        localStorage.setItem('meta_capsule_zip_name', file.name);

        setActiveTab('dashboard');
        worker.terminate();
        workerRef.current = null;
      } else if (type === 'ERROR') {
        setIsIngesting(false);
        setIngestionError(payload.message);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (error) => {
      console.error('Worker error:', error);
      setIsIngesting(false);
      setIngestionError("Une erreur technique est survenue dans le worker d'ingestion.");
      worker.terminate();
      workerRef.current = null;
    };

    worker.postMessage({ type: 'START', file });
  }, [applyZipFile, isIngesting]);

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

  const ingestFromDrop = useCallback(async (dataTransfer: DataTransfer) => {
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
        // Drag-drop without FSA handle: session-only media access after ingest
        startIngestion(file, null);
      }
    } catch (error: unknown) {
      console.error('ingestFromDrop failed:', error);
      setIngestionError(
        error instanceof Error ? error.message : "Échec de l'import depuis le glisser-déposer."
      );
    }
  }, [isIngesting, startIngestion]);

  const attachZipForMedia = useCallback(async (file: File, handle?: FileSystemFileHandle | null) => {
    revokeAllMediaUrls();
    applyZipFile(file, handle ?? null);

    if (handle) {
      await saveArchiveHandle(handle);
    }

    setIngestionStatusText('');
  }, [applyZipFile]);

  const reauthorizeZipAccess = useCallback(async () => {
    const handle = handleRef.current ?? (await loadArchiveHandle());
    if (!handle) {
      setZipAccessState('unavailable');
      return;
    }

    handleRef.current = handle;

    try {
      const permission = await ensureReadPermission(handle);
      if (permission !== 'granted') {
        setZipAccessState('unavailable');
        setIngestionStatusText(
          "Permission refusée. Re-sélectionnez le fichier ZIP pour voir les médias."
        );
        return;
      }

      const file = await handle.getFile();
      revokeAllMediaUrls();
      applyZipFile(file, handle);
      setIngestionStatusText('');
    } catch (error) {
      console.error('reauthorizeZipAccess failed:', error);
      setZipAccessState('unavailable');
    }
  }, [applyZipFile]);

  const pickZipForMedia = useCallback(async () => {
    try {
      if (supportsFileSystemAccess) {
        const handle = await pickZipFileHandle();
        if (!handle) return;
        const file = await handle.getFile();
        if (!file.name.toLowerCase().endsWith('.zip')) {
          setIngestionError('Veuillez sélectionner une archive .zip.');
          return;
        }
        await attachZipForMedia(file, handle);
        return;
      }

      // Non-FSA browsers: caller should use a hidden <input type="file">
    } catch (error: unknown) {
      console.error('pickZipForMedia failed:', error);
      setIngestionError(
        error instanceof Error ? error.message : "Impossible de réactiver l'accès au ZIP."
      );
    }
  }, [attachZipForMedia, supportsFileSystemAccess]);

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
    setZipFile(null);
    setZipFileName(null);
    setZipAccessState('none');
    handleRef.current = null;
    setActiveTab('import');

    await db.clearAll();
    localStorage.removeItem('meta_capsule_stats');
    localStorage.removeItem('meta_capsule_zip_name');

    revokeAllMediaUrls();
  }, []);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  return (
    <ArchiveContext.Provider
      value={{
        zipFile,
        zipAccessState,
        zipFileName,
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
        ingestFromDrop,
        attachZipForMedia,
        reauthorizeZipAccess,
        pickZipForMedia,
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
