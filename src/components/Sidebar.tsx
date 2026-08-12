import React, { useEffect, useState } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { useShell } from '../context/ShellContext';
import { db } from '../db/db';
import type { UserProfile } from '../db/models';
import { ProfileAvatar } from './ProfileAvatar';
import { LayoutDashboard, MessageSquare, Image, Award, Settings, LogOut, Package, X } from 'lucide-react';
import type { TranslationKey } from '../i18n';

function platformBadgeClass(platform: string): string {
  if (platform === 'facebook') return 'bg-blue-600 text-white border-transparent';
  if (platform === 'instagram') {
    return 'bg-gradient-to-tr from-amber-500 via-red-500 to-purple-600 text-white border-transparent';
  }
  return 'border-ink-600 text-ink-300';
}

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, resetArchive, stats, zipFile } = useArchive();
  const { t } = useLanguage();
  const { isNavOpen, closeNav } = useShell();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!stats?.platform) {
        setProfile(null);
        return;
      }
      const row = await db.profiles.get(`${stats.platform}:profile`);
      if (!cancelled) setProfile(row ?? null);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [stats?.platform]);

  const menuItems = [
    { id: 'dashboard' as const, labelKey: 'nav.dashboard' as TranslationKey, icon: LayoutDashboard },
    { id: 'messages' as const, labelKey: 'nav.messages' as TranslationKey, icon: MessageSquare },
    { id: 'gallery' as const, labelKey: 'nav.gallery' as TranslationKey, icon: Image },
    { id: 'ads' as const, labelKey: 'nav.ads' as TranslationKey, icon: Award },
    { id: 'settings' as const, labelKey: 'nav.settings' as TranslationKey, icon: Settings },
  ];

  const go = (id: (typeof menuItems)[number]['id']) => {
    setActiveTab(id);
    closeNav();
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-ink-950/50 transition-opacity md:hidden ${
          isNavOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeNav}
        aria-hidden={!isNavOpen}
      />

      <aside
        className={`mc-surface-ink w-60 border-r border-ink-800 flex flex-col h-full shrink-0
          fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out
          md:static md:translate-x-0 md:z-auto
          ${isNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        aria-modal={isNavOpen || undefined}
        role="navigation"
      >
        <div className="px-5 py-5 border-b border-ink-800 flex items-center gap-3">
          <div className="w-9 h-9 border border-ink-700 text-brand-400 flex items-center justify-center">
            <Package size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-semibold mc-text-on-ink text-lg leading-none tracking-[-0.02em]">
              Meta Capsule
            </h1>
            <span className="text-[11px] text-ink-400 font-medium">v1.0.0</span>
          </div>
          <button
            type="button"
            onClick={closeNav}
            className="md:hidden p-2 -mr-1 text-ink-400 hover:text-white rounded-md"
            aria-label={t('nav.closeMenu')}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-ink-300 hover:bg-ink-900 hover:text-white'
                }`}
              >
                <Icon size={17} className={isActive ? 'text-white' : 'text-ink-400'} />
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-ink-800 space-y-3">
          {stats && (
            <div className="mc-surface-ink-muted px-3 py-3 border border-ink-700 flex items-center gap-3 rounded-md">
              <ProfileAvatar
                name={stats.ownerName || t('common.user')}
                relativePath={profile?.profilePicture}
                zipFile={zipFile}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-[11px] text-ink-400 font-medium leading-none mb-1">{t('app.archiveOf')}</p>
                <p className="font-semibold mc-text-on-ink text-sm truncate">
                  {stats.ownerName || t('common.user')}
                </p>
                <span
                  className={`inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 border text-[10px] font-semibold uppercase tracking-wider ${platformBadgeClass(stats.platform)}`}
                >
                  {stats.platform}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              closeNav();
              void resetArchive();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md font-medium text-sm text-red-400 hover:bg-ink-900 hover:text-red-300 transition-colors"
          >
            <LogOut size={17} />
            {t('app.closeArchive')}
          </button>
        </div>
      </aside>
    </>
  );
};
