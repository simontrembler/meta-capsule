import React, { useRef } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { ShieldCheck, AlertTriangle, FileCheck, Upload, KeyRound } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    activeTab,
    zipFile,
    zipFileName,
    zipAccessState,
    supportsFileSystemAccess,
    attachZipForMedia,
    reauthorizeZipAccess,
    pickZipForMedia
  } = useArchive();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return "Synthèse de l'activité";
      case 'messages':
        return 'Messagerie';
      case 'gallery':
        return 'Galerie Médias';
      case 'ads':
        return 'Transparence Publicitaire';
      case 'settings':
        return 'Paramètres';
      default:
        return 'Meta-Capsule';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith('.zip')) {
        // Attach for media only — IndexedDB already has parsed data
        await attachZipForMedia(file, null);
      }
    }
    e.target.value = '';
  };

  const handleRestoreClick = async () => {
    if (zipAccessState === 'needs-permission') {
      await reauthorizeZipAccess();
      return;
    }

    if (supportsFileSystemAccess) {
      await pickZipForMedia();
      return;
    }

    fileInputRef.current?.click();
  };

  return (
    <header className="h-20 bg-white border-b border-slate-100 px-8 flex items-center justify-between sticky top-0 z-10 shrink-0">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">{getTitle()}</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold shadow-sm">
          <ShieldCheck size={14} className="shrink-0" />
          <span>100% Local & Sécurisé</span>
        </div>

        {zipAccessState === 'ready' && zipFile ? (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold shadow-sm">
            <FileCheck size={14} className="shrink-0" />
            <span className="max-w-[150px] truncate">{zipFile.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-xs font-bold shadow-sm">
              <AlertTriangle size={14} className="shrink-0" />
              <span>
                {zipAccessState === 'needs-permission'
                  ? 'Accès ZIP en attente'
                  : 'Mode texte seul (Images désactivées)'}
              </span>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".zip,application/zip"
              className="hidden"
            />
            <button
              onClick={handleRestoreClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/10 transition-all duration-150"
              title={
                zipAccessState === 'needs-permission'
                  ? "Réactiver la permission de lecture sur l'archive (sans réimporter)"
                  : "Sélectionner le fichier ZIP d'origine pour charger les images"
              }
            >
              {zipAccessState === 'needs-permission' ? (
                <>
                  <KeyRound size={12} />
                  <span>Réactiver l'accès</span>
                </>
              ) : (
                <>
                  <Upload size={12} />
                  <span>{zipFileName ? 'Recharger ZIP' : 'Charger ZIP'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
