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
    <header className="h-16 bg-[#FFFEFB] border-b border-ink-200 px-6 flex items-center justify-between sticky top-0 z-10 shrink-0">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink-950 tracking-[-0.02em]">
          {t(titleKeys[activeTab] || 'nav.dashboard')}
        </h2>
      </div>

      <div className="flex items-center gap-2.5">
        <LanguageToggle compact />

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-ink-200 text-ink-600 text-xs font-semibold">
          <ShieldCheck size={13} className="shrink-0 text-brand-600" />
          <span>{t('app.localSecure')}</span>
        </div>

        {zipAccessState === 'ready' && zipFile ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-ink-200 text-ink-700 text-xs font-semibold">
            <FileCheck size={13} className="shrink-0 text-brand-600" />
            <span className="max-w-[150px] truncate">{zipFile.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-ink-300 text-ink-700 text-xs font-semibold">
              <AlertTriangle size={13} className="shrink-0 text-brand-600" />
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1C1B1A] hover:bg-[#2F2C29] text-[#F7F1EA] text-xs font-semibold transition-colors"
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
