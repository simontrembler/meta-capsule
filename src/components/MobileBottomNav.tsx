import React from 'react';
import { useArchive, type ActiveTab } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { LayoutDashboard, MessageSquare, Image, Package, Settings } from 'lucide-react';
import type { TranslationKey } from '../i18n';

const items: {
  id: Extract<ActiveTab, 'dashboard' | 'messages' | 'gallery' | 'archives' | 'settings'>;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { id: 'messages', labelKey: 'nav.messages', icon: MessageSquare },
  { id: 'gallery', labelKey: 'nav.gallery', icon: Image },
  { id: 'archives', labelKey: 'nav.archives', icon: Package },
  { id: 'settings', labelKey: 'nav.settings', icon: Settings }
];

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useArchive();
  const { t } = useLanguage();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 md:hidden border-t border-ink-200 bg-white pb-[env(safe-area-inset-bottom,0px)]"
      aria-label={t('nav.primary')}
    >
      <div className="flex items-stretch justify-between h-14">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0 px-1 transition-colors ${
                isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
              <span className="text-[10px] font-semibold truncate max-w-full leading-tight">
                {t(item.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
