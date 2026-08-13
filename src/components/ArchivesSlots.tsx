import React, { useRef } from 'react';
import { useArchive, type ArchivePlatform } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import type { TranslationKey } from '../i18n';
import { Plus, RefreshCw, Trash2, Upload, KeyRound, FileCheck, AlertTriangle } from 'lucide-react';

function platformLabelKey(platform: ArchivePlatform): TranslationKey {
  return platform === 'facebook' ? 'archives.facebook' : 'archives.instagram';
}

function platformBadgeClass(platform: ArchivePlatform): string {
  if (platform === 'facebook') return 'bg-blue-600 text-white';
  return 'bg-gradient-to-tr from-amber-500 via-red-500 to-purple-600 text-white';
}

const PLATFORMS: ArchivePlatform[] = ['facebook', 'instagram'];

type Variant = 'settings' | 'sidebar';

export const ArchivesSlots: React.FC<{ variant?: Variant }> = ({ variant = 'settings' }) => {
  const {
    stats,
    zipFiles,
    zipAccessByPlatform,
    zipNames,
    isIngesting,
    supportsFileSystemAccess,
    pickAndIngestForPlatform,
    pickZipForMedia,
    reauthorizeZipAccess,
    attachZipForMedia,
    removePlatform
  } = useArchive();
  const { t } = useLanguage();
  const fileInputs = useRef<Partial<Record<ArchivePlatform, HTMLInputElement | null>>>({});

  const compact = variant === 'sidebar';

  const handleAddOrReplace = async (platform: ArchivePlatform) => {
    const hasData = Boolean(stats?.archives[platform]);
    if (hasData) {
      const ok = window.confirm(
        t('archives.replaceConfirm', { platform: t(platformLabelKey(platform)) })
      );
      if (!ok) return;
    }
    await pickAndIngestForPlatform(platform);
  };

  const handleRemove = async (platform: ArchivePlatform) => {
    const ok = window.confirm(
      t('archives.removeConfirm', { platform: t(platformLabelKey(platform)) })
    );
    if (!ok) return;
    await removePlatform(platform);
  };

  const handleMediaFile = async (platform: ArchivePlatform, file: File) => {
    await attachZipForMedia(file, null, platform);
  };

  const handleRestoreMedia = async (platform: ArchivePlatform) => {
    const access = zipAccessByPlatform[platform];
    if (access === 'needs-permission') {
      await reauthorizeZipAccess(platform);
      return;
    }
    if (supportsFileSystemAccess) {
      await pickZipForMedia(platform);
      return;
    }
    fileInputs.current[platform]?.click();
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {PLATFORMS.map((platform) => {
        const meta = stats?.archives[platform];
        const zipReady = Boolean(zipFiles[platform]);
        const access = zipAccessByPlatform[platform] ?? (meta ? 'unavailable' : 'none');
        const name = zipNames[platform] || meta?.zipFileName;

        return (
          <div
            key={platform}
            className={`border border-ink-200 rounded-md ${
              compact ? 'px-2.5 py-2 bg-ink-900/40 border-ink-700' : 'p-4 bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`shrink-0 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${platformBadgeClass(platform)} ${
                  compact ? '' : 'mt-0.5'
                }`}
              >
                {platform === 'facebook' ? 'FB' : 'IG'}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={`font-semibold truncate ${
                    compact ? 'text-xs text-ink-100' : 'text-sm text-ink-950'
                  }`}
                >
                  {t(platformLabelKey(platform))}
                </p>

                {meta ? (
                  <>
                    <p
                      className={`truncate ${
                        compact ? 'text-[10px] text-ink-400' : 'text-xs text-ink-500 mt-0.5'
                      }`}
                    >
                      {meta.ownerName}
                      {!compact && name ? ` · ${name}` : ''}
                    </p>
                    {!compact && (
                      <p className="text-[11px] text-ink-400 mt-1">
                        {t('archives.counts', {
                          messages: meta.messagesCount,
                          media: meta.mediaCount,
                          posts: meta.postsCount
                        })}
                      </p>
                    )}
                    <div
                      className={`flex items-center gap-1 mt-1 ${
                        compact ? 'text-[10px]' : 'text-xs'
                      } ${zipReady ? 'text-brand-600' : 'text-ink-500'}`}
                    >
                      {zipReady ? (
                        <>
                          <FileCheck size={compact ? 10 : 12} />
                          <span>{t('archives.mediaReady')}</span>
                        </>
                      ) : access === 'needs-permission' ? (
                        <>
                          <KeyRound size={compact ? 10 : 12} />
                          <span>{t('archives.mediaPending')}</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={compact ? 10 : 12} />
                          <span>{t('archives.mediaMissing')}</span>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <p className={`mt-0.5 ${compact ? 'text-[10px] text-ink-500' : 'text-xs text-ink-500'}`}>
                    {t('archives.empty')}
                  </p>
                )}
              </div>
            </div>

            <div className={`flex flex-wrap gap-1.5 ${compact ? 'mt-2' : 'mt-3'}`}>
              <input
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                ref={(el) => {
                  fileInputs.current[platform] = el;
                }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file?.name.toLowerCase().endsWith('.zip')) {
                    void handleMediaFile(platform, file);
                  }
                  e.target.value = '';
                }}
              />

              {!meta ? (
                <button
                  type="button"
                  disabled={isIngesting}
                  onClick={() => void handleAddOrReplace(platform)}
                  className={`inline-flex items-center gap-1.5 rounded-md font-semibold transition-colors disabled:opacity-50 ${
                    compact
                      ? 'px-2 py-1 text-[10px] bg-brand-600 text-white hover:bg-brand-500'
                      : 'px-3 py-1.5 text-xs bg-[#1C1B1A] text-[#F7F1EA] hover:bg-[#2F2C29]'
                  }`}
                >
                  <Plus size={compact ? 11 : 14} />
                  {t('archives.add')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isIngesting}
                    onClick={() => void handleAddOrReplace(platform)}
                    className={`inline-flex items-center gap-1.5 rounded-md font-semibold border transition-colors disabled:opacity-50 ${
                      compact
                        ? 'px-2 py-1 text-[10px] border-ink-600 text-ink-200 hover:bg-ink-800'
                        : 'px-3 py-1.5 text-xs border-ink-300 text-ink-700 hover:bg-ink-50'
                    }`}
                  >
                    <RefreshCw size={compact ? 11 : 14} />
                    {t('archives.replace')}
                  </button>

                  {!zipReady && (
                    <button
                      type="button"
                      disabled={isIngesting}
                      onClick={() => void handleRestoreMedia(platform)}
                      className={`inline-flex items-center gap-1.5 rounded-md font-semibold transition-colors disabled:opacity-50 ${
                        compact
                          ? 'px-2 py-1 text-[10px] bg-brand-600 text-white hover:bg-brand-500'
                          : 'px-3 py-1.5 text-xs bg-brand-600 text-white hover:bg-brand-500'
                      }`}
                    >
                      {access === 'needs-permission' ? (
                        <KeyRound size={compact ? 11 : 14} />
                      ) : (
                        <Upload size={compact ? 11 : 14} />
                      )}
                      {access === 'needs-permission'
                        ? t('archives.reactivate')
                        : t('archives.reloadMedia')}
                    </button>
                  )}

                  {!compact && (
                    <button
                      type="button"
                      disabled={isIngesting}
                      onClick={() => void handleRemove(platform)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      {t('archives.remove')}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
