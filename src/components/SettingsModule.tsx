import React from 'react';
import { useArchive } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageToggle } from './LanguageToggle';
import { SupportLinks } from './SupportLinks';
import { Trash2, Database, ShieldAlert, Heart } from 'lucide-react';

export const SettingsModule: React.FC = () => {
  const { resetArchive } = useArchive();
  const { t } = useLanguage();

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl space-y-4">
      <div className="bg-white border border-ink-200 rounded-md p-6 space-y-4">
        <h3 className="font-display text-lg font-semibold text-ink-950">{t('settings.languageTitle')}</h3>
        <p className="text-ink-600 text-sm">{t('settings.languageBody')}</p>
        <LanguageToggle />
      </div>

      <div className="bg-white border border-ink-200 rounded-md p-6 space-y-4">
        <div className="flex items-center gap-3 text-brand-700">
          <ShieldAlert size={20} />
          <h3 className="font-display text-lg font-semibold text-ink-950">{t('settings.privacyTitle')}</h3>
        </div>
        <p className="text-ink-600 text-sm leading-relaxed">{t('settings.privacyBody')}</p>
        <div className="p-4 border border-ink-200 text-xs text-ink-500 space-y-1">
          <p>• <strong className="text-ink-700">{t('settings.storage')}</strong> {t('settings.storageValue')}</p>
          <p>• <strong className="text-ink-700">{t('settings.zipAccess')}</strong> {t('settings.zipAccessValue')}</p>
          <p>• <strong className="text-ink-700">{t('settings.telemetry')}</strong> {t('settings.telemetryValue')}</p>
          <p>• <strong className="text-ink-700">{t('settings.internet')}</strong> {t('settings.internetValue')}</p>
        </div>
      </div>

      <div className="bg-white border border-ink-200 rounded-md p-6 space-y-4">
        <div className="flex items-center gap-3 text-ink-700">
          <Heart size={20} className="text-brand-600" />
          <h3 className="font-display text-lg font-semibold text-ink-950">{t('support.title')}</h3>
        </div>
        <p className="text-ink-600 text-sm leading-relaxed">{t('support.body')}</p>
        <SupportLinks />
      </div>

      <div className="bg-white border border-ink-200 rounded-md p-6 space-y-4">
        <div className="flex items-center gap-3 text-ink-700">
          <Database size={20} />
          <h3 className="font-display text-lg font-semibold text-ink-950">{t('settings.dataTitle')}</h3>
        </div>
        <p className="text-ink-600 text-sm">{t('settings.dataBody')}</p>

        <div className="pt-2">
          <button
            onClick={resetArchive}
            className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-sm transition-colors"
          >
            <Trash2 size={16} />
            {t('settings.deleteData')}
          </button>
        </div>
      </div>
    </div>
  );
};
