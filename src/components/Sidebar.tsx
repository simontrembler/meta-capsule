import React, { useEffect, useState } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../db/db';
import type { UserProfile } from '../db/models';
import { ProfileAvatar } from './ProfileAvatar';
import { LayoutDashboard, MessageSquare, Image, Award, Settings, LogOut, Package } from 'lucide-react';
import type { TranslationKey } from '../i18n';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, resetArchive, stats, zipFile } = useArchive();
  const { t } = useLanguage();
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

  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0 shrink-0">
      <div className="p-6 border-b border-slate-50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
          <Package size={22} />
        </div>
        <div>
          <h1 className="font-extrabold text-brand-950 text-lg leading-none">Meta-Capsule</h1>
          <span className="text-xs text-slate-400 font-medium">v1.0.0 (MVP)</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-brand-50 text-brand-700 shadow-sm shadow-brand-100/50'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-brand-600' : 'text-slate-400'} />
              {t(item.labelKey)}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-50 space-y-4">
        {stats && (
          <div className="px-4 py-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center gap-3">
            <ProfileAvatar
              name={stats.ownerName || t('common.user')}
              relativePath={profile?.profilePicture}
              zipFile={zipFile}
              size="sm"
            />
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium leading-none mb-1">{t('app.archiveOf')}</p>
              <p className="font-bold text-slate-800 text-sm truncate">{stats.ownerName || t('common.user')}</p>
              <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-brand-100 text-brand-700 text-[10px] font-bold uppercase tracking-wider">
                {stats.platform}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={resetArchive}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
        >
          <LogOut size={18} />
          {t('app.closeArchive')}
        </button>
      </div>
    </aside>
  );
};
