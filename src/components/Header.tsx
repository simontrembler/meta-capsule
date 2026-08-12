import React, { useRef } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageToggle } from './LanguageToggle';
import { ShieldCheck, AlertTriangle, FileCheck, Upload, KeyRound } from 'lucide-react';
import type { TranslationKey } from '../i18n';

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
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const titleKeys: Record<string, TranslationKey> = {
    dashboard: 'title.dashboard',
    messages: 'title.messages',
    gallery: 'title.gallery',
    ads: 'title.ads',
    settings: 'title.settings'
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith('.zip')) {
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
        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
          {t(titleKeys[activeTab] || 'nav.dashboard')}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <LanguageToggle compact />

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold shadow-sm">
          <ShieldCheck size={14} className="shrink-0" />
          <span>{t('app.localSecure')}</span>
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
                {zipAccessState === 'needs-permission' ? t('app.zipPending') : t('app.textOnly')}
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
                  ? t('app.reactivateTitle')
                  : t('app.loadZipTitle')
              }
            >
              {zipAccessState === 'needs-permission' ? (
                <>
                  <KeyRound size={12} />
                  <span>{t('app.reactivateAccess')}</span>
                </>
              ) : (
                <>
                  <Upload size={12} />
                  <span>{zipFileName ? t('app.reloadZip') : t('app.loadZip')}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
