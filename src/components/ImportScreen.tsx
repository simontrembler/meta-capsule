import React, { useCallback, useRef, useState } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';
import { AlertCircle, Lock, ShieldCheck, WifiOff } from 'lucide-react';
import { SupportLinks } from './SupportLinks';
import { LoadingCapsule } from './LoadingCapsule';

export const ImportScreen: React.FC = () => {
  const {
    startIngestion,
    pickAndIngestZip,
    pickAndIngestFolder,
    ingestFromDrop,
    supportsFileSystemAccess,
    isIngesting,
    ingestionProgress,
    ingestionStatusText,
    ingestionError
  } = useArchive();
  const { t } = useLanguage();
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

  const handleChooseFolderClick = useCallback(async () => {
    await pickAndIngestFolder();
  }, [pickAndIngestFolder]);

  return (
    <div className="landing-grid relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 animate-grid-fade opacity-100" aria-hidden />

      <div className="absolute top-5 right-5 z-20 sm:top-6 sm:right-6 flex items-center gap-2">
        <ThemeToggle compact />
        <LanguageToggle compact />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16 lg:px-10">
        {!isIngesting ? (
          <>
            {/* Hero — one composition */}
            <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
              {/* Brand column */}
              <div className="animate-brand-in lg:col-span-5">
                <p className="mb-4 font-sans text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">
                  Time capsule
                </p>
                <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-ink-950 sm:text-5xl lg:text-[3.35rem]">
                  Meta Capsule
                </h1>
                <p className="mt-4 max-w-md font-display text-2xl font-medium leading-snug tracking-[-0.01em] text-ink-800 sm:text-3xl">
                  {t('import.headline')}
                </p>
                <p className="mt-4 max-w-sm text-base leading-relaxed text-ink-500">
                  {t('import.tagline')}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleChooseClick}
                    className="inline-flex items-center justify-center rounded-md bg-ink-950 px-5 py-3 font-sans text-sm font-semibold tracking-wide text-brand-50 transition-colors hover:bg-ink-800"
                  >
                    {t('import.choose')}
                  </button>
                  <button
                    type="button"
                    onClick={handleChooseFolderClick}
                    className="inline-flex items-center justify-center rounded-md border border-ink-300 bg-white px-5 py-3 font-sans text-sm font-semibold tracking-wide text-ink-800 transition-colors hover:bg-ink-50"
                  >
                    {t('import.chooseFolder')}
                  </button>
                  <span className="inline-flex items-center gap-1.5 border border-ink-200 bg-ink-50/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    <Lock size={12} className="text-brand-600" />
                    {t('import.privacyBadge')}
                  </span>
                </div>

                <p className="mt-4 max-w-md text-xs leading-relaxed text-ink-400">
                  {t('import.facebookMultiZip')}
                </p>

                {ingestionError && (
                  <div className="mt-6 flex max-w-md items-start gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <AlertCircle className="mt-0.5 shrink-0" size={18} />
                    <div>
                      <span className="font-semibold">{t('import.error')}</span> {ingestionError}
                    </div>
                  </div>
                )}
              </div>

              {/* Capsule visual + drop */}
              <div className="animate-capsule-in relative flex justify-center lg:col-span-7 lg:justify-end">
                <div
                  className={`capsule-shell relative flex aspect-[4/5] w-full max-w-md items-center justify-center border transition-colors duration-300 sm:max-w-lg ${
                    isDragActive
                      ? 'border-brand-500 bg-brand-50/80'
                      : 'border-ink-300/80 bg-ink-50/70'
                  }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  {/* Geometric rings */}
                  <div
                    className="pointer-events-none absolute inset-[8%] capsule-shell border border-ink-200/80 animate-ring-pulse"
                    aria-hidden
                  />
                  <div
                    className="pointer-events-none absolute inset-[18%] capsule-shell border border-brand-400/50"
                    aria-hidden
                  />
                  <div
                    className="pointer-events-none absolute inset-[28%] capsule-shell border border-ink-200/60"
                    aria-hidden
                  />

                  <input
                    type="file"
                    ref={fileInputRef}
                    id="file-upload"
                    className="hidden"
                    accept=".zip,application/zip"
                    onChange={handleFileInput}
                  />

                  <button
                    type="button"
                    onClick={handleChooseClick}
                    className="relative z-10 flex w-[70%] flex-col items-center gap-3 px-4 py-8 text-center outline-none"
                  >
                    <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-600">
                      ZIP / DOSSIER
                    </span>
                    <span className="font-display text-lg font-semibold leading-snug text-ink-900 sm:text-xl">
                      {t('import.drop')}
                    </span>
                    <span className="max-w-[16rem] text-xs leading-relaxed text-ink-500">
                      {supportsFileSystemAccess ? t('import.hintFsa') : t('import.hintBrowse')}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Below fold — privacy proofs (not in hero) */}
            <section className="mt-20 border-t border-ink-200/80 pt-10 animate-brand-in [animation-delay:180ms]">
              <div className="grid gap-8 sm:grid-cols-3">
                <div>
                  <div className="mb-3 flex h-9 w-9 items-center justify-center border border-ink-200 text-brand-700">
                    <Lock size={16} />
                  </div>
                  <h2 className="font-display text-sm font-semibold text-ink-900">{t('import.localTitle')}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{t('import.localDesc')}</p>
                </div>
                <div>
                  <div className="mb-3 flex h-9 w-9 items-center justify-center border border-ink-200 text-brand-700">
                    <WifiOff size={16} />
                  </div>
                  <h2 className="font-display text-sm font-semibold text-ink-900">{t('import.airplaneTitle')}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{t('import.airplaneDesc')}</p>
                </div>
                <div>
                  <div className="mb-3 flex h-9 w-9 items-center justify-center border border-ink-200 text-brand-700">
                    <ShieldCheck size={16} />
                  </div>
                  <h2 className="font-display text-sm font-semibold text-ink-900">{t('import.telemetryTitle')}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{t('import.telemetryDesc')}</p>
                </div>
              </div>

              <div className="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-ink-200/80 pt-8">
                <p className="text-sm text-ink-500 max-w-md">{t('support.body')}</p>
                <SupportLinks compact />
              </div>
            </section>
          </>
        ) : (
          <div className="mx-auto flex w-full max-w-lg flex-col items-center py-10 text-center animate-capsule-in">
            <LoadingCapsule progress={ingestionProgress} />
            <h2 className="mt-8 font-display text-2xl font-semibold text-ink-950">{t('import.inProgress')}</h2>
            <p className="mt-2 text-sm text-ink-500">{ingestionStatusText}</p>
            <div className="mt-6 h-1.5 w-full overflow-hidden bg-ink-200">
              <div
                className="h-full bg-brand-600 transition-all duration-300 ease-out"
                style={{ width: `${ingestionProgress}%` }}
              />
            </div>
            <p className="mt-4 text-xs text-ink-400">{t('import.dontClose')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
