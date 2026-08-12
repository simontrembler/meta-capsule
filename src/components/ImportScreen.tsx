import React, { useCallback, useRef, useState } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { UploadCloud, FileArchive, ShieldCheck, AlertCircle, Lock, WifiOff } from 'lucide-react';

export const ImportScreen: React.FC = () => {
  const {
    startIngestion,
    pickAndIngestZip,
    ingestFromDrop,
    supportsFileSystemAccess,
    isIngesting,
    ingestionProgress,
    ingestionStatusText,
    ingestionError
  } = useArchive();
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    await ingestFromDrop(e.dataTransfer);
  }, [ingestFromDrop]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith('.zip')) {
        // Fallback path: no persistent handle
        startIngestion(file, null);
      }
    }
    e.target.value = '';
  }, [startIngestion]);

  const handleChooseClick = useCallback(async () => {
    if (supportsFileSystemAccess) {
      await pickAndIngestZip();
      return;
    }
    fileInputRef.current?.click();
  }, [pickAndIngestZip, supportsFileSystemAccess]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-brand-50">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl border border-brand-100/80 p-8 md:p-12 transition-all duration-300">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-100 text-brand-600 mb-4 animate-pulse">
            <FileArchive size={32} />
          </div>
          <h1 className="text-4xl font-extrabold text-brand-950 tracking-tight mb-2">Meta-Capsule</h1>
          <p className="text-slate-600 text-lg max-w-md mx-auto">
            Redécouvrez vos archives Facebook & Instagram en toute sécurité, 100% hors-ligne.
          </p>
        </div>

        {!isIngesting ? (
          <div className="space-y-6">
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-8 md:p-12 text-center transition-all duration-200 ${
                isDragActive
                  ? 'border-brand-500 bg-brand-50/50 scale-[1.01]'
                  : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50/50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                id="file-upload"
                className="hidden"
                accept=".zip,application/zip"
                onChange={handleFileInput}
              />
              <div className="flex flex-col items-center justify-center">
                <UploadCloud size={48} className="text-brand-400 mb-4" />
                <p className="text-slate-700 font-semibold text-lg mb-1">
                  Glissez votre archive .zip ici
                </p>
                <p className="text-slate-400 text-sm mb-4">
                  {supportsFileSystemAccess
                    ? 'Accès fichier persisté (Chrome/Edge) — pas de rechargement après F5'
                    : 'ou cliquez pour parcourir vos fichiers'}
                </p>
                <button
                  type="button"
                  onClick={handleChooseClick}
                  className="inline-flex items-center px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium text-sm shadow-md shadow-brand-600/20 transition-colors"
                >
                  Choisir un fichier
                </button>
              </div>
            </div>

            {ingestionError && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm">
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <div>
                  <span className="font-semibold">Erreur d'importation :</span> {ingestionError}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <div className="flex flex-col items-center text-center p-3">
                <div className="text-brand-600 mb-2">
                  <Lock size={20} />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm mb-1">100% Local</h3>
                <p className="text-xs text-slate-500">
                  Aucun serveur. Vos données restent dans votre navigateur.
                </p>
              </div>

              <div className="flex flex-col items-center text-center p-3">
                <div className="text-brand-600 mb-2">
                  <WifiOff size={20} />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm mb-1">Mode Avion</h3>
                <p className="text-xs text-slate-500">
                  Fonctionne parfaitement sans connexion Internet.
                </p>
              </div>

              <div className="flex flex-col items-center text-center p-3">
                <div className="text-brand-600 mb-2">
                  <ShieldCheck size={20} />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm mb-1">Zéro Télémétrie</h3>
                <p className="text-xs text-slate-500">
                  Pas de trackers, pas de cookies publicitaires, pas d'analytics.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center space-y-6">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-24 h-24 rounded-full border-4 border-slate-100 border-t-brand-600 animate-spin"></div>
              <div className="absolute text-brand-700 font-bold text-lg">
                {ingestionProgress}%
              </div>
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-slate-800">Importation en cours...</h3>
              <p className="text-slate-500 text-sm animate-pulse">
                {ingestionStatusText}
              </p>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-brand-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${ingestionProgress}%` }}
              ></div>
            </div>

            <p className="text-xs text-slate-400">
              Veuillez ne pas fermer cet onglet pendant le traitement. Cela peut prendre quelques minutes pour les archives volumineuses.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
