import React, { useEffect, useRef, useState } from 'react';
import { useArchive, type ArchivePlatform } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';
import { GlobalSearch } from './GlobalSearch';
import { SupportLinks } from './SupportLinks';
import { ShieldCheck, AlertTriangle, FileCheck, Upload, KeyRound, Search } from 'lucide-react';
import type { TranslationKey } from '../i18n';

function PlatformZipChip({ platform }: { platform: ArchivePlatform }) {
  const {
    zipAccessByPlatform,
    zipNames,
    stats,
    reauthorizeZipAccess,
    pickZipForMedia,
    supportsFileSystemAccess,
    attachZipForMedia,
    hasMediaAccess
  } = useArchive();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const meta = stats?.archives[platform];
  if (!meta) return null;

  const ready = hasMediaAccess(platform);
  const access = zipAccessByPlatform[platform] ?? 'unavailable';
  const label = platform === 'facebook' ? 'FB' : 'IG';
  const name = zipNames[platform] || meta.zipFileName || label;

  const restore = async () => {
    if (access === 'needs-permission') {
      await reauthorizeZipAccess(platform);
      return;
    }
    if (supportsFileSystemAccess) {
      await pickZipForMedia(platform);
      return;
    }
    fileInputRef.current?.click();
  };

  if (ready) {
    return (
      <div
        className="flex items-center gap-1 px-1.5 py-1 border border-ink-200 text-ink-700 text-[10px] font-semibold max-w-[5.5rem] sm:max-w-[7rem]"
        title={name || undefined}
      >
        <FileCheck size={11} className="shrink-0 text-brand-600" />
        <span className="truncate">{label}</span>
      </div>
    );
  }

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file?.name.toLowerCase().endsWith('.zip')) {
            void attachZipForMedia(file, null, platform);
          }
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => void restore()}
        className="flex items-center gap-1 px-1.5 py-1 border border-ink-300 text-ink-700 text-[10px] font-semibold hover:bg-ink-50"
        title={
          access === 'needs-permission' ? t('app.reactivateTitle') : t('app.loadZipTitle')
        }
      >
        {access === 'needs-permission' ? <KeyRound size={11} /> : <Upload size={11} />}
        <span>{label}</span>
      </button>
    </>
  );
}

export const Header: React.FC = () => {
  const { activeTab, zipAccessState, stats, hasMediaAccess } = useArchive();
  const { t } = useLanguage();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const titleKeys: Record<string, TranslationKey> = {
    dashboard: 'title.dashboard',
    messages: 'title.messages',
    gallery: 'title.gallery',
    archives: 'title.archives',
    ads: 'title.ads',
    settings: 'title.settings'
  };

  const platforms = stats?.platforms ?? [];
  const allReady = platforms.length > 0 && platforms.every((p) => hasMediaAccess(p));
  const anyPending = platforms.some((p) => !hasMediaAccess(p) && stats?.archives[p] != null);

  return (
    <header className="min-h-14 h-auto md:h-16 bg-white border-b border-ink-200 px-3 sm:px-4 md:px-6 py-2 md:py-0 flex items-center justify-between gap-2 flex-wrap sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="font-display text-lg md:text-xl font-semibold text-ink-950 tracking-[-0.02em] truncate">
          {t(titleKeys[activeTab] || 'nav.dashboard')}
        </h2>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="p-2 border border-ink-200 text-ink-700 hover:bg-ink-100"
          title={t('search.open')}
          aria-label={t('search.open')}
        >
          <Search size={14} />
        </button>
        <ThemeToggle compact />
        <LanguageToggle compact />
        <SupportLinks variant="icon" />

        <div
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 border border-ink-200 text-ink-600 text-xs font-semibold"
          title={t('app.localSecure')}
        >
          <ShieldCheck size={13} className="shrink-0 text-brand-600" />
          <span className="hidden lg:inline">{t('app.localSecure')}</span>
        </div>

        {platforms.length > 0 && (
          <div className="flex items-center gap-1">
            {platforms.map((p) => (
              <PlatformZipChip key={p} platform={p} />
            ))}
          </div>
        )}

        {anyPending && !allReady && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 border border-ink-300 text-ink-700 text-xs font-semibold">
            <AlertTriangle size={13} className="shrink-0 text-brand-600" />
            <span>
              {zipAccessState === 'needs-permission' ? t('app.zipPending') : t('app.textOnly')}
            </span>
          </div>
        )}
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
};
