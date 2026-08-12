import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface LanguageToggleProps {
  compact?: boolean;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ compact = false }) => {
  const { locale, setLocale, t } = useLanguage();

  if (compact) {
    return (
      <div className="inline-flex items-center rounded-xl bg-slate-50 border border-slate-100 p-0.5">
        <button
          type="button"
          onClick={() => setLocale('fr')}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all ${
            locale === 'fr' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          FR
        </button>
        <button
          type="button"
          onClick={() => setLocale('en')}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all ${
            locale === 'en' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          EN
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-slate-700">
        <Languages size={18} className="text-brand-600" />
        <span className="font-bold text-sm">{t('lang.label')}</span>
      </div>
      <div className="inline-flex bg-slate-50 p-1 rounded-xl border border-slate-100">
        <button
          type="button"
          onClick={() => setLocale('fr')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            locale === 'fr' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {t('lang.fr')}
        </button>
        <button
          type="button"
          onClick={() => setLocale('en')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            locale === 'en' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {t('lang.en')}
        </button>
      </div>
    </div>
  );
};
