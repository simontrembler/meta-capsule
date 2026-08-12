import React, { useRef } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { ShieldCheck, AlertTriangle, FileCheck, Upload } from 'lucide-react';

export const Header: React.FC = () => {
  const { activeTab, zipFile, startIngestion } = useArchive();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Synthèse de l\'activité';
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith('.zip')) {
        // If they select a zip, we can re-ingest it or just set it as the active zipFile
        // Let's re-ingest it to ensure the DB matches the selected ZIP file.
        startIngestion(file);
      }
    }
  };

  return (
    <header className="h-20 bg-white border-b border-slate-100 px-8 flex items-center justify-between sticky top-0 z-10 shrink-0">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">{getTitle()}</h2>
      </div>

      {/* Right-side status indicators */}
      <div className="flex items-center gap-4">
        {/* Offline / Security Indicator */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold shadow-sm">
          <ShieldCheck size={14} className="shrink-0" />
          <span>100% Local & Sécurisé</span>
        </div>

        {/* ZIP File Status */}
        {zipFile ? (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold shadow-sm">
            <FileCheck size={14} className="shrink-0" />
            <span className="max-w-[150px] truncate">{zipFile.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-xs font-bold shadow-sm">
              <AlertTriangle size={14} className="shrink-0" />
              <span>Mode texte seul (Images désactivées)</span>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".zip"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/10 transition-all duration-150"
              title="Sélectionner le fichier ZIP d'origine pour charger les images"
            >
              <Upload size={12} />
              <span>Charger ZIP</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
