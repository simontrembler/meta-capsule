import React, { useEffect, useState } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../db/db';
import type { UserProfile } from '../db/models';
import { MessageSquare, Image, Award, User, Mail, Phone, ArrowRight } from 'lucide-react';
import { ProfileAvatar } from './ProfileAvatar';

interface DashboardStats {
  totalMessages: number;
  totalMedia: number;
  totalPosts: number;
  dateRange: { start: string; end: string } | null;
  activityData: Array<{ year: string; count: number }>;
}

export const DashboardModule: React.FC = () => {
  const { stats, setActiveTab, getZipFile } = useArchive();
  const { t, dateLocale } = useLanguage();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dbStats, setDbStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const primaryZip = stats?.platform ? getZipFile(stats.platform) : null;
  const displayUsername =
    profile?.username ||
    (primaryZip?.name.match(/^instagram-([^/\\]+?)-\d{4}/i)?.[1] ?? '');

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        const activePlatform = stats?.platform || 'facebook';
        const profileId = `${activePlatform}:profile`;
        const userProfile = await db.profiles.get(profileId);
        if (userProfile) {
          setProfile(userProfile);
        }

        const totalMessages = await db.messages.count();
        const totalMedia = await db.media.count();
        const totalPosts = await db.posts.count();

        let startTimestamp = Infinity;
        let endTimestamp = 0;

        const firstMsg = await db.messages.orderBy('timestamp').first();
        const lastMsg = await db.messages.orderBy('timestamp').last();
        if (firstMsg) startTimestamp = Math.min(startTimestamp, firstMsg.timestamp);
        if (lastMsg) endTimestamp = Math.max(endTimestamp, lastMsg.timestamp);

        const firstPost = await db.posts.orderBy('timestamp').first();
        const lastPost = await db.posts.orderBy('timestamp').last();
        if (firstPost) startTimestamp = Math.min(startTimestamp, firstPost.timestamp);
        if (lastPost) endTimestamp = Math.max(endTimestamp, lastPost.timestamp);

        let dateRange = null;
        if (startTimestamp !== Infinity && endTimestamp !== 0) {
          const formatDate = (ts: number) => {
            return new Date(ts).toLocaleDateString(dateLocale, {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            });
          };
          dateRange = {
            start: formatDate(startTimestamp),
            end: formatDate(endTimestamp)
          };
        }

        const yearCounts: { [year: string]: number } = {};

        await db.messages.each(msg => {
          if (msg.timestamp) {
            const year = new Date(msg.timestamp).getFullYear().toString();
            yearCounts[year] = (yearCounts[year] || 0) + 1;
          }
        });

        await db.posts.each(post => {
          if (post.timestamp) {
            const year = new Date(post.timestamp).getFullYear().toString();
            yearCounts[year] = (yearCounts[year] || 0) + 1;
          }
        });

        const activityData = Object.entries(yearCounts)
          .map(([year, count]) => ({ year, count }))
          .sort((a, b) => a.year.localeCompare(b.year));

        setDbStats({
          totalMessages,
          totalMedia,
          totalPosts,
          dateRange,
          activityData
        });
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [stats, dateLocale]);

  if (isLoading || !dbStats) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
        <div className="w-10 h-10 rounded-full border-2 border-ink-200 border-t-brand-600 animate-spin mb-4" />
        <p className="text-ink-500 text-sm font-medium">{t('dashboard.loading')}</p>
      </div>
    );
  }

  const maxCount = Math.max(...dbStats.activityData.map(d => d.count), 1);
  const chartHeight = 160;
  const chartWidth = 500;
  const padding = 30;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 max-w-6xl mx-auto">
      {/* Flat ink hero — forced surface for contrast */}
      <div className="mc-surface-ink px-4 py-5 sm:px-7 sm:py-7 rounded-md">
        <span className="inline-flex items-center px-2 py-0.5 border border-ink-600 mc-text-on-ink-accent text-[10px] font-semibold uppercase tracking-[0.18em]">
          {t('dashboard.badge')}
        </span>
        <h1 className="mt-3 font-display text-2xl sm:text-3xl font-semibold tracking-[-0.02em] mc-text-on-ink">
          {t('dashboard.hello', { name: profile?.name || stats?.ownerName || t('common.explorer') })}
        </h1>
        <p className="mt-2 mc-text-on-ink-muted text-sm md:text-base max-w-xl leading-relaxed">
          {dbStats.dateRange
            ? t('dashboard.readyRange', { start: dbStats.dateRange.start, end: dbStats.dateRange.end })
            : t('dashboard.readyGeneric')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('messages')}
          className="bg-white p-5 border border-ink-200 rounded-md flex items-center gap-4 hover:border-brand-500 hover:bg-brand-50 transition-colors text-left group"
        >
          <div className="w-10 h-10 border border-ink-200 text-ink-600 flex items-center justify-center shrink-0 group-hover:border-brand-400 group-hover:text-brand-600 transition-colors">
            <MessageSquare size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-ink-400 font-semibold uppercase tracking-wider mb-0.5">{t('dashboard.messages')}</p>
            <h3 className="font-display text-2xl font-semibold text-ink-950">{dbStats.totalMessages.toLocaleString(dateLocale)}</h3>
          </div>
          <ArrowRight size={16} className="text-ink-300 group-hover:text-brand-600 shrink-0 transition-colors" />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gallery')}
          className="bg-white p-5 border border-ink-200 rounded-md flex items-center gap-4 hover:border-brand-500 hover:bg-brand-50 transition-colors text-left group"
        >
          <div className="w-10 h-10 border border-ink-200 text-ink-600 flex items-center justify-center shrink-0 group-hover:border-brand-400 group-hover:text-brand-600 transition-colors">
            <Image size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-ink-400 font-semibold uppercase tracking-wider mb-0.5">{t('dashboard.media')}</p>
            <h3 className="font-display text-2xl font-semibold text-ink-950">{dbStats.totalMedia.toLocaleString(dateLocale)}</h3>
          </div>
          <ArrowRight size={16} className="text-ink-300 group-hover:text-brand-600 shrink-0 transition-colors" />
        </button>

        <div className="bg-white p-5 border border-ink-200 rounded-md flex items-center gap-4">
          <div className="w-10 h-10 border border-ink-200 text-ink-600 flex items-center justify-center shrink-0">
            <Award size={20} />
          </div>
          <div>
            <p className="text-[11px] text-ink-400 font-semibold uppercase tracking-wider mb-0.5">{t('dashboard.posts')}</p>
            <h3 className="font-display text-2xl font-semibold text-ink-950">{dbStats.totalPosts.toLocaleString(dateLocale)}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white p-6 border border-ink-200 rounded-md flex flex-col">
          <h3 className="font-display text-lg font-semibold text-ink-950 mb-1">{t('dashboard.activityTitle')}</h3>
          <p className="text-xs text-ink-400 mb-6">{t('dashboard.activitySubtitle')}</p>

          {dbStats.activityData.length > 0 ? (
            <div className="flex-1 flex flex-col justify-end min-h-[200px]">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full">
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = padding + (chartHeight - 2 * padding) * (1 - ratio);
                  const label = Math.round(maxCount * ratio);
                  return (
                    <g key={idx}>
                      <line
                        x1={padding}
                        y1={y}
                        x2={chartWidth - padding}
                        y2={y}
                        stroke="#D4CFC6"
                        strokeWidth={1}
                      />
                      <text
                        x={padding - 5}
                        y={y + 4}
                        fill="#8E877C"
                        fontSize={10}
                        textAnchor="end"
                        fontWeight="600"
                      >
                        {label >= 1000 ? `${(label / 1000).toFixed(0)}k` : label}
                      </text>
                    </g>
                  );
                })}

                {dbStats.activityData.map((d, idx) => {
                  const barWidth = (chartWidth - 2 * padding) / dbStats.activityData.length - 8;
                  const x = padding + idx * ((chartWidth - 2 * padding) / dbStats.activityData.length) + 4;
                  const barHeight = (d.count / maxCount) * (chartHeight - 2 * padding);
                  const y = chartHeight - padding - barHeight;

                  return (
                    <g key={d.year}>
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        fill="#9A6B3F"
                        rx={2}
                      />
                      <text
                        x={x + barWidth / 2}
                        y={chartHeight - padding + 15}
                        fill="#6F6A63"
                        fontSize={10}
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        '{d.year.substring(2)}
                      </text>
                      <title>{t('dashboard.interactions', { year: d.year, count: d.count.toLocaleString(dateLocale) })}</title>
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center border border-dashed border-ink-200 rounded-md p-8">
              <p className="text-ink-400 text-sm">{t('dashboard.noActivity')}</p>
            </div>
          )}
        </div>

        <div className="bg-white p-6 border border-ink-200 rounded-md flex flex-col justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink-950 mb-4">{t('dashboard.profileTitle')}</h3>

            {profile ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-4 border-b border-ink-100">
                  <ProfileAvatar
                    name={profile.name}
                    relativePath={profile.profilePicture}
                    zipFile={primaryZip}
                    size="md"
                  />
                  <div>
                    <h4 className="font-semibold text-ink-900 leading-none mb-1">{profile.name}</h4>
                    {displayUsername ? (
                      <p className="text-xs text-ink-400">@{displayUsername}</p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  {profile.email && (
                    <div className="flex items-center gap-3 text-ink-600">
                      <Mail size={16} className="text-ink-400 shrink-0" />
                      <span className="mc-selectable truncate">{profile.email}</span>
                    </div>
                  )}
                  {profile.phoneNumber && (
                    <div className="flex items-center gap-3 text-ink-600">
                      <Phone size={16} className="text-ink-400 shrink-0" />
                      <span>{profile.phoneNumber}</span>
                    </div>
                  )}
                  {profile.bio && (
                    <div className="flex items-start gap-3 text-ink-600">
                      <User size={16} className="text-ink-400 shrink-0 mt-0.5" />
                      <p className="mc-selectable text-xs leading-relaxed italic">"{profile.bio}"</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <User size={36} className="text-ink-300 mx-auto mb-2" />
                <p className="text-ink-400 text-xs">{t('dashboard.noProfile')}</p>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-ink-100 space-y-2 mt-6">
            <button
              onClick={() => setActiveTab('messages')}
              className="w-full flex items-center justify-between px-3 py-2.5 border border-ink-200 text-ink-700 text-xs font-semibold transition-colors group hover:border-brand-500 hover:bg-brand-50 hover:text-brand-800"
            >
              <span>{t('dashboard.openMessages')}</span>
              <ArrowRight size={14} className="text-ink-400 group-hover:text-brand-600 transition-colors" />
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className="w-full flex items-center justify-between px-3 py-2.5 border border-ink-200 text-ink-700 text-xs font-semibold transition-colors group hover:border-brand-500 hover:bg-brand-50 hover:text-brand-800"
            >
              <span>{t('dashboard.openGallery')}</span>
              <ArrowRight size={14} className="text-ink-400 group-hover:text-brand-600 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
