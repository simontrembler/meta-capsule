import React, { useRef } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { useShell } from '../context/ShellContext';
import { LanguageToggle } from './LanguageToggle';
import { ShieldCheck, AlertTriangle, FileCheck, Upload, KeyRound, Menu } from 'lucide-react';
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
  const { toggleNav } = useShell();
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
    <header className="min-h-14 h-auto md:h-16 bg-[#FFFEFB] border-b border-ink-200 px-3 sm:px-4 md:px-6 py-2 md:py-0 flex items-center justify-between gap-2 sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={toggleNav}
          className="md:hidden p-2 -ml-1 rounded-md text-ink-700 hover:bg-ink-100 shrink-0"
          aria-label={t('nav.openMenu')}
        >
          <Menu size={20} />
        </button>
        <h2 className="font-display text-lg md:text-xl font-semibold text-ink-950 tracking-[-0.02em] truncate">
          {t(titleKeys[activeTab] || 'nav.dashboard')}
        </h2>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <LanguageToggle compact />

        <div
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 border border-ink-200 text-ink-600 text-xs font-semibold"
          title={t('app.localSecure')}
        >
          <ShieldCheck size={13} className="shrink-0 text-brand-600" />
          <span className="hidden lg:inline">{t('app.localSecure')}</span>
        </div>

        {zipAccessState === 'ready' && zipFile ? (
          <div
            className="flex items-center gap-1.5 px-2 py-1.5 border border-ink-200 text-ink-700 text-xs font-semibold max-w-[9rem] sm:max-w-[12rem] md:max-w-none"
            title={zipFile.name}
          >
            <FileCheck size={13} className="shrink-0 text-brand-600" />
            <span className="truncate">{zipFile.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 border border-ink-300 text-ink-700 text-xs font-semibold"
            >
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
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md bg-[#1C1B1A] hover:bg-[#2F2C29] text-[#F7F1EA] text-xs font-semibold transition-colors"
              title={
                zipAccessState === 'needs-permission'
                  ? t('app.reactivateTitle')
                  : t('app.loadZipTitle')
              }
            >
              {zipAccessState === 'needs-permission' ? (
                <>
                  <KeyRound size={12} />
                  <span className="hidden sm:inline">{t('app.reactivateAccess')}</span>
                </>
              ) : (
                <>
                  <Upload size={12} />
                  <span className="hidden sm:inline">{zipFileName ? t('app.reloadZip') : t('app.loadZip')}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
