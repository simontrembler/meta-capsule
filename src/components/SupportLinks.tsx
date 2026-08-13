import React from 'react';
import { Coffee, Github } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const GITHUB_REPO_URL = 'https://github.com/simontrembler/meta-capsule';
export const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/simontremblay';

type SupportLinksProps = {
  /** denser row for landing footer — prefer `variant` for new call sites */
  compact?: boolean;
  /** default = labeled buttons; compact = smaller labeled; icon = header icon-only */
  variant?: 'default' | 'compact' | 'icon';
};

export const SupportLinks: React.FC<SupportLinksProps> = ({ compact = false, variant }) => {
  const { t } = useLanguage();
  const mode = variant ?? (compact ? 'compact' : 'default');

  if (mode === 'icon') {
    const iconBtn =
      'inline-flex items-center justify-center p-2 border border-ink-200 text-ink-700 hover:bg-ink-100 transition-colors';
    return (
      <div className="flex items-center gap-1.5">
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={iconBtn}
          title={t('support.github')}
          aria-label={t('support.github')}
        >
          <Github size={14} />
        </a>
        <a
          href={BUY_ME_A_COFFEE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={iconBtn}
          title={t('support.coffee')}
          aria-label={t('support.coffee')}
        >
          <Coffee size={14} />
        </a>
      </div>
    );
  }

  const isCompact = mode === 'compact';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${isCompact ? '' : 'gap-3'}`}>
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 border border-ink-200 text-ink-800 hover:border-ink-950 hover:bg-ink-50 transition-colors font-semibold ${
          isCompact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm rounded-md'
        }`}
      >
        <Github size={isCompact ? 14 : 16} />
        {t('support.github')}
      </a>
      <a
        href={BUY_ME_A_COFFEE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 bg-ink-950 text-brand-50 hover:bg-ink-800 transition-colors font-semibold ${
          isCompact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm rounded-md'
        }`}
      >
        <Coffee size={isCompact ? 14 : 16} />
        {t('support.coffee')}
      </a>
    </div>
  );
};
