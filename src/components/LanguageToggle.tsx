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
      <div className="inline-flex items-center border border-ink-200 p-0.5">
        <button
          type="button"
          onClick={() => setLocale('fr')}
          className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            locale === 'fr' ? 'bg-ink-950 text-brand-50' : 'text-ink-600 hover:text-ink-950 hover:bg-ink-100'
          }`}
        >
          FR
        </button>
        <button
          type="button"
          onClick={() => setLocale('en')}
          className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            locale === 'en' ? 'bg-ink-950 text-brand-50' : 'text-ink-600 hover:text-ink-950 hover:bg-ink-100'
          }`}
        >
          EN
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-ink-800">
        <Languages size={18} className="text-brand-600" />
        <span className="font-semibold text-sm">{t('lang.label')}</span>
      </div>
      <div className="inline-flex border border-ink-200 p-0.5">
        <button
          type="button"
          onClick={() => setLocale('fr')}
          className={`px-4 py-2 text-xs font-semibold transition-colors ${
            locale === 'fr' ? 'bg-ink-950 text-brand-50' : 'text-ink-600 hover:text-ink-950'
          }`}
        >
          {t('lang.fr')}
        </button>
        <button
          type="button"
          onClick={() => setLocale('en')}
          className={`px-4 py-2 text-xs font-semibold transition-colors ${
            locale === 'en' ? 'bg-ink-950 text-brand-50' : 'text-ink-600 hover:text-ink-950'
          }`}
        >
          {t('lang.en')}
        </button>
      </div>
    </div>
  );
};
