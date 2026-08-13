import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme, type ThemeMode } from '../context/ThemeContext';
import type { TranslationKey } from '../i18n';

const modes: { id: ThemeMode; label: TranslationKey; compact: string }[] = [
  { id: 'light', label: 'theme.light', compact: 'theme.lightShort' },
  { id: 'dark', label: 'theme.dark', compact: 'theme.darkShort' },
  { id: 'system', label: 'theme.system', compact: 'theme.systemShort' }
];

export const ThemeToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { mode, resolved, setMode } = useTheme();
  const { t } = useLanguage();

  if (compact) {
    return (
      <div className="inline-flex items-center border border-ink-200 p-0.5" role="group" aria-label={t('theme.label')}>
        <button
          type="button"
          onClick={() => setMode('light')}
          className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            mode === 'light' || (mode === 'system' && resolved === 'light')
              ? 'bg-ink-950 text-brand-50'
              : 'text-ink-600 hover:text-ink-950 hover:bg-ink-100'
          }`}
          title={t('theme.light')}
        >
          {t('theme.lightShort')}
        </button>
        <button
          type="button"
          onClick={() => setMode('dark')}
          className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            mode === 'dark' || (mode === 'system' && resolved === 'dark')
              ? 'bg-ink-950 text-brand-50'
              : 'text-ink-600 hover:text-ink-950 hover:bg-ink-100'
          }`}
          title={t('theme.dark')}
        >
          {t('theme.darkShort')}
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-wrap border border-ink-200 p-0.5" role="group" aria-label={t('theme.label')}>
      {modes.map((item) => {
        const Icon = item.id === 'dark' ? Moon : item.id === 'light' ? Sun : Monitor;
        const active = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setMode(item.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
              active ? 'bg-ink-950 text-brand-50' : 'text-ink-600 hover:text-ink-950 hover:bg-ink-100'
            }`}
          >
            <Icon size={14} />
            {t(item.label)}
          </button>
        );
      })}
    </div>
  );
};
