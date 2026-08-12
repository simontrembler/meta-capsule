import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db } from '../db/db';
import { revokeAllMediaUrls } from '../utils/zipMediaResolver';

interface IngestionStats {
  messagesCount: number;
  mediaCount: number;
  postsCount: number;
  platform: 'facebook' | 'instagram';
  ownerName: string;
}

interface ArchiveContextType {
  zipFile: File | null;
  activeTab: 'import' | 'dashboard' | 'messages' | 'gallery' | 'ads' | 'settings';
  setActiveTab: (tab: 'import' | 'dashboard' | 'messages' | 'gallery' | 'ads' | 'settings') => void;
  isIngesting: boolean;
  ingestionProgress: number;
  ingestionStatusText: string;
  ingestionError: string | null;
  stats: IngestionStats | null;
  startIngestion: (file: File) => void;
  resetArchive: () => Promise<void>;
}

const ArchiveContext = createContext<ArchiveContextType | undefined>(undefined);

export const ArchiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'import' | 'dashboard' | 'messages' | 'gallery' | 'ads' | 'settings'>('import');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionProgress, setIngestionProgress] = useState(0);
  const [ingestionStatusText, setIngestionStatusText] = useState('');
  const [ingestionError, setIngestionError] = useState<string | null>(null);
  const [stats, setStats] = useState<IngestionStats | null>(null);
  
  const workerRef = useRef<Worker | null>(null);

  // Load state from localStorage on startup if available
  useEffect(() => {
    const savedStats = localStorage.getItem('meta_capsule_stats');
    const savedZipName = localStorage.getItem('meta_capsule_zip_name');
    
    if (savedStats && savedZipName) {
      setStats(JSON.parse(savedStats));
      setActiveTab('dashboard');
      // Note: We can't restore the actual File object from localStorage,
      // so the user will need to re-select the ZIP if they want to view media,
      // but they can still browse text data from IndexedDB!
      setIngestionStatusText("Données restaurées depuis la base locale. Pour voir les images, veuillez re-sélectionner l'archive.");
    }
  }, []);

  const startIngestion = (file: File) => {
    if (isIngesting) return;

    setZipFile(file);
    setIsIngesting(true);
    setIngestionProgress(0);
    setIngestionStatusText('Initialisation du traitement...');
    setIngestionError(null);
    setStats(null);

    // Revoke previous media URLs
    revokeAllMediaUrls();

    // Create the Web Worker
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
        
        // Save metadata to localStorage
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
      setIngestionError('Une erreur technique est survenue dans le worker d\'ingestion.');
      worker.terminate();
      workerRef.current = null;
    };

    // Start the worker
    worker.postMessage({ type: 'START', file });
  };

  const resetArchive = async () => {
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
    setActiveTab('import');

    // Clear IndexedDB and localStorage
    await db.clearAll();
    localStorage.removeItem('meta_capsule_stats');
    localStorage.removeItem('meta_capsule_zip_name');

    // Revoke all media URLs
    revokeAllMediaUrls();
  };

  // Cleanup worker on unmount
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
        activeTab,
        setActiveTab,
        isIngesting,
        ingestionProgress,
        ingestionStatusText,
        ingestionError,
        stats,
        startIngestion,
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
