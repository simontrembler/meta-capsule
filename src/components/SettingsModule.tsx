import React from 'react';
import { useArchive } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageToggle } from './LanguageToggle';
import { Trash2, Database, ShieldAlert } from 'lucide-react';

export const SettingsModule: React.FC = () => {
  const { resetArchive } = useArchive();
  const { t } = useLanguage();

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-800">{t('settings.languageTitle')}</h3>
        <p className="text-slate-600 text-sm">{t('settings.languageBody')}</p>
        <LanguageToggle />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3 text-brand-700">
          <ShieldAlert size={22} />
          <h3 className="text-lg font-bold text-slate-800">{t('settings.privacyTitle')}</h3>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed">{t('settings.privacyBody')}</p>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 space-y-1">
          <p>• <strong>{t('settings.storage')}</strong> {t('settings.storageValue')}</p>
          <p>• <strong>{t('settings.zipAccess')}</strong> {t('settings.zipAccessValue')}</p>
          <p>• <strong>{t('settings.telemetry')}</strong> {t('settings.telemetryValue')}</p>
          <p>• <strong>{t('settings.internet')}</strong> {t('settings.internetValue')}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3 text-slate-700">
          <Database size={22} />
          <h3 className="text-lg font-bold text-slate-800">{t('settings.dataTitle')}</h3>
        </div>
        <p className="text-slate-600 text-sm">{t('settings.dataBody')}</p>

        <div className="pt-2">
          <button
            onClick={resetArchive}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-semibold text-sm transition-colors"
          >
            <Trash2 size={16} />
            {t('settings.deleteData')}
          </button>
        </div>
      </div>
    </div>
  );
};
