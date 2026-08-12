import React from 'react';
import { Coffee, Github } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const GITHUB_REPO_URL = 'https://github.com/simontrembler/meta-capsule';
export const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/simontremblay';

type SupportLinksProps = {
  /** denser row for landing footer */
  compact?: boolean;
};

export const SupportLinks: React.FC<SupportLinksProps> = ({ compact = false }) => {
  const { t } = useLanguage();

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'gap-3'}`}>
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 border border-ink-200 text-ink-800 hover:border-ink-950 hover:bg-ink-50 transition-colors font-semibold ${
          compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm rounded-md'
        }`}
      >
        <Github size={compact ? 14 : 16} />
        {t('support.github')}
      </a>
      <a
        href={BUY_ME_A_COFFEE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 bg-[#1C1B1A] text-[#F7F1EA] hover:bg-[#2F2C29] transition-colors font-semibold ${
          compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm rounded-md'
        }`}
      >
        <Coffee size={compact ? 14 : 16} />
        {t('support.coffee')}
      </a>
    </div>
  );
};
