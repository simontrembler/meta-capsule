import React from 'react';
import { useArchive } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { ArchivesSlots } from './ArchivesSlots';
import { LogOut, Package } from 'lucide-react';

export const ArchivesModule: React.FC = () => {
  const { resetArchive } = useArchive();
  const { t } = useLanguage();

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl space-y-4 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px)+1rem)] md:pb-8">
      <div className="bg-white border border-ink-200 rounded-md p-6 space-y-4">
        <div className="flex items-center gap-3 text-brand-700">
          <Package size={20} />
          <h3 className="font-display text-lg font-semibold text-ink-950">{t('archives.title')}</h3>
        </div>
        <p className="text-ink-600 text-sm">{t('archives.body')}</p>
        <ArchivesSlots variant="settings" />
      </div>

      <div className="bg-white border border-ink-200 rounded-md p-6">
        <button
          type="button"
          onClick={() => void resetArchive()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-sm transition-colors"
        >
          <LogOut size={16} />
          {t('app.closeArchive')}
        </button>
      </div>
    </div>
  );
};
