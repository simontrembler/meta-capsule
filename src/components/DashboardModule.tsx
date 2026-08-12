import React, { useEffect, useState } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../db/db';
import type { UserProfile } from '../db/models';
import { MessageSquare, Image, Award, Calendar, User, Mail, Phone, ArrowRight } from 'lucide-react';
import { ProfileAvatar } from './ProfileAvatar';

interface DashboardStats {
  totalMessages: number;
  totalMedia: number;
  totalPosts: number;
  dateRange: { start: string; end: string } | null;
  activityData: Array<{ year: string; count: number }>;
}

export const DashboardModule: React.FC = () => {
  const { stats, setActiveTab, zipFile } = useArchive();
  const { t, dateLocale } = useLanguage();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dbStats, setDbStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const displayUsername =
    profile?.username ||
    (zipFile?.name.match(/^instagram-([^/\\]+?)-\d{4}/i)?.[1] ?? '');

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        // 1. Load Profile
        const activePlatform = stats?.platform || 'facebook';
        const profileId = `${activePlatform}:profile`;
        const userProfile = await db.profiles.get(profileId);
        if (userProfile) {
          setProfile(userProfile);
        }

        // 2. Calculate Counts
        const totalMessages = await db.messages.count();
        const totalMedia = await db.media.count();
        const totalPosts = await db.posts.count();

        // 3. Calculate Date Range
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

        // 4. Calculate Activity by Year
        const yearCounts: { [year: string]: number } = {};

        // Aggregate messages by year
        await db.messages.each(msg => {
          if (msg.timestamp) {
            const year = new Date(msg.timestamp).getFullYear().toString();
            yearCounts[year] = (yearCounts[year] || 0) + 1;
          }
        });

        // Aggregate posts by year
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
      <div className="flex flex-col items-center justify-center h-[calc(100vh-5rem)]">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-600 animate-spin mb-4"></div>
        <p className="text-slate-500 text-sm font-medium">{t('dashboard.loading')}</p>
      </div>
    );
  }

  // SVG Chart Calculations
  const maxCount = Math.max(...dbStats.activityData.map(d => d.count), 1);
  const chartHeight = 160;
  const chartWidth = 500;
  const padding = 30;

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-3xl p-8 text-white shadow-lg shadow-brand-600/10 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-10 pointer-events-none">
          <Calendar size={300} />
        </div>
        <div className="relative z-10 space-y-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider">
            {t('dashboard.badge')}
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {t('dashboard.hello', { name: profile?.name || stats?.ownerName || t('common.explorer') })}
          </h1>
          <p className="text-brand-100 text-sm md:text-base max-w-xl leading-relaxed">
            {dbStats.dateRange
              ? t('dashboard.readyRange', { start: dbStats.dateRange.start, end: dbStats.dateRange.end })
              : t('dashboard.readyGeneric')}
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Messages KPI */}
        <button
          type="button"
          onClick={() => setActiveTab('messages')}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-md hover:border-brand-200 hover:bg-brand-50/30 transition-all duration-200 text-left cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 group-hover:bg-brand-100 transition-colors">
            <MessageSquare size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">{t('dashboard.messages')}</p>
            <h3 className="text-2xl font-extrabold text-slate-800">{dbStats.totalMessages.toLocaleString(dateLocale)}</h3>
          </div>
          <ArrowRight size={16} className="text-slate-300 group-hover:text-brand-600 shrink-0 transition-colors" />
        </button>

        {/* Media KPI */}
        <button
          type="button"
          onClick={() => setActiveTab('gallery')}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-md hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-200 text-left cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
            <Image size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">{t('dashboard.media')}</p>
            <h3 className="text-2xl font-extrabold text-slate-800">{dbStats.totalMedia.toLocaleString(dateLocale)}</h3>
          </div>
          <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-600 shrink-0 transition-colors" />
        </button>

        {/* Posts KPI */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow duration-200">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Award size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">{t('dashboard.posts')}</p>
            <h3 className="text-2xl font-extrabold text-slate-800">{dbStats.totalPosts.toLocaleString(dateLocale)}</h3>
          </div>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Activity Chart Section */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 mb-1">{t('dashboard.activityTitle')}</h3>
          <p className="text-xs text-slate-400 mb-6">{t('dashboard.activitySubtitle')}</p>
          
          {dbStats.activityData.length > 0 ? (
            <div className="flex-1 flex flex-col justify-end min-h-[200px]">
              {/* Responsive SVG Chart */}
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full">
                {/* Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = padding + (chartHeight - 2 * padding) * (1 - ratio);
                  const label = Math.round(maxCount * ratio);
                  return (
                    <g key={idx} className="opacity-40">
                      <line
                        x1={padding}
                        y1={y}
                        x2={chartWidth - padding}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                      />
                      <text
                        x={padding - 5}
                        y={y + 4}
                        fill="#94a3b8"
                        fontSize={10}
                        textAnchor="end"
                        fontWeight="bold"
                      >
                        {label >= 1000 ? `${(label / 1000).toFixed(0)}k` : label}
                      </text>
                    </g>
                  );
                })}

                {/* Bars */}
                {dbStats.activityData.map((d, idx) => {
                  const barWidth = (chartWidth - 2 * padding) / dbStats.activityData.length - 8;
                  const x = padding + idx * ((chartWidth - 2 * padding) / dbStats.activityData.length) + 4;
                  const barHeight = (d.count / maxCount) * (chartHeight - 2 * padding);
                  const y = chartHeight - padding - barHeight;

                  return (
                    <g key={d.year} className="group cursor-pointer">
                      {/* Bar */}
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        fill="url(#barGradient)"
                        rx={4}
                        className="transition-all duration-200 hover:opacity-90"
                      />
                      {/* Year Label */}
                      <text
                        x={x + barWidth / 2}
                        y={chartHeight - padding + 15}
                        fill="#64748b"
                        fontSize={10}
                        textAnchor="middle"
                        fontWeight="semibold"
                      >
                        '{d.year.substring(2)}
                      </text>
                      {/* Tooltip on Hover */}
                      <title>{t('dashboard.interactions', { year: d.year, count: d.count.toLocaleString(dateLocale) })}</title>
                    </g>
                  );
                })}

                {/* Gradients */}
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ca583b" />
                    <stop offset="100%" stopColor="#e59c84" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center border border-dashed border-slate-100 rounded-xl p-8">
              <p className="text-slate-400 text-sm">{t('dashboard.noActivity')}</p>
            </div>
          )}
        </div>

        {/* Profile Details Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">{t('dashboard.profileTitle')}</h3>
            
            {profile ? (
              <div className="space-y-4">
                {/* Profile Header */}
                <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
                  <ProfileAvatar
                    name={profile.name}
                    relativePath={profile.profilePicture}
                    zipFile={zipFile}
                    size="md"
                  />
                  <div>
                    <h4 className="font-bold text-slate-800 leading-none mb-1">{profile.name}</h4>
                    {displayUsername ? (
                      <p className="text-xs text-slate-400">@{displayUsername}</p>
                    ) : null}
                  </div>
                </div>

                {/* Profile Fields */}
                <div className="space-y-3 text-sm">
                  {profile.email && (
                    <div className="flex items-center gap-3 text-slate-600">
                      <Mail size={16} className="text-slate-400 shrink-0" />
                      <span className="truncate">{profile.email}</span>
                    </div>
                  )}
                  {profile.phoneNumber && (
                    <div className="flex items-center gap-3 text-slate-600">
                      <Phone size={16} className="text-slate-400 shrink-0" />
                      <span>{profile.phoneNumber}</span>
                    </div>
                  )}
                  {profile.bio && (
                    <div className="flex items-start gap-3 text-slate-600">
                      <User size={16} className="text-slate-400 shrink-0 mt-0.5" />
                      <p className="text-xs leading-relaxed italic">"{profile.bio}"</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <User size={36} className="text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-xs">{t('dashboard.noProfile')}</p>
              </div>
            )}
          </div>

          {/* Quick Shortcuts */}
          <div className="pt-6 border-t border-slate-50 space-y-2 mt-6">
            <button
              onClick={() => setActiveTab('messages')}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-brand-50 hover:text-brand-700 text-slate-600 text-xs font-bold transition-all duration-150 group"
            >
              <span>{t('dashboard.openMessages')}</span>
              <ArrowRight size={14} className="text-slate-400 group-hover:text-brand-600 transition-colors" />
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-brand-50 hover:text-brand-700 text-slate-600 text-xs font-bold transition-all duration-150 group"
            >
              <span>{t('dashboard.openGallery')}</span>
              <ArrowRight size={14} className="text-slate-400 group-hover:text-brand-600 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
