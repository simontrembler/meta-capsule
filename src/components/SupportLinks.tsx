import React from 'react';
import { Coffee } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const GITHUB_REPO_URL = 'https://github.com/simontrembler/meta-capsule';
export const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/simontremblay';

/** Brand mark — Lucide v1 removed trademarked icons like Github. */
const GithubMark: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

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
          <GithubMark size={14} />
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
        <GithubMark size={isCompact ? 14 : 16} />
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
