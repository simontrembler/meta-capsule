import React, { useEffect, useState } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../db/db';
import type { Conversation, MediaAttachment, MediaSource, UserProfile } from '../db/models';
import { MessageSquare, Image, Award, User, Mail, Phone, ArrowRight, MapPin, Film, Mic } from 'lucide-react';
import { ProfileAvatar } from './ProfileAvatar';
import { PlacesMap, hasGpsCoords } from './PlacesMap';
import { VisitedPlacesList } from './VisitedPlacesList';
import { useVisitedPlaces } from '../hooks/useVisitedPlaces';
import { loadOnThisDay, loadTopConversations, type OnThisDayItem } from '../utils/memories';
import { getMediaBlobUrl, type MediaArchiveSource } from '../utils/zipMediaResolver';
import type { TranslationKey } from '../i18n';

interface DashboardStats {
  totalMessages: number;
  totalMedia: number;
  totalPosts: number;
  dateRange: { start: string; end: string } | null;
  activityData: Array<{ year: string; count: number }>;
}

function yearsAgoLabel(
  timestamp: number,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
): string {
  const years = new Date().getFullYear() - new Date(timestamp).getFullYear();
  return years > 0 ? t('dashboard.yearsAgo', { count: years }) : String(new Date(timestamp).getFullYear());
}

function mediaTypeLabel(
  type: MediaAttachment['type'],
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
): string {
  if (type === 'video') return t('dashboard.onThisDayVideo');
  if (type === 'audio') return t('gallery.voice');
  return t('dashboard.onThisDayPhoto');
}

function mediaSourceKey(source: MediaSource | undefined): TranslationKey {
  switch (source) {
    case 'post':
      return 'gallery.sourceLabel.post';
    case 'story':
      return 'gallery.sourceLabel.story';
    case 'message':
      return 'gallery.sourceLabel.message';
    default:
      return 'gallery.sourceLabel.other';
  }
}

const OnThisDayMediaThumb: React.FC<{
  item: MediaAttachment;
  archiveSource: MediaArchiveSource | null;
}> = ({ item, archiveSource }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!archiveSource || item.type === 'audio') return;
    let mounted = true;
    void getMediaBlobUrl(archiveSource, item.relativePath)
      .then((url) => {
        if (mounted) setBlobUrl(url);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [archiveSource, item.relativePath, item.type]);

  const shell =
    'w-12 h-12 shrink-0 overflow-hidden rounded-md border border-ink-200 bg-ink-100';

  if (item.type === 'audio') {
    return (
      <div className={`${shell} flex items-center justify-center text-ink-600`}>
        <Mic size={18} />
      </div>
    );
  }

  if (blobUrl && item.type === 'video') {
    return (
      <div className={`${shell} relative bg-ink-950`}>
        <video src={blobUrl} muted playsInline className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <Film size={14} className="text-white" />
        </div>
      </div>
    );
  }

  if (blobUrl) {
    return <img src={blobUrl} alt="" className={`${shell} object-cover`} />;
  }

  return <div className={shell} />;
};

export const DashboardModule: React.FC = () => {
  const { stats, setActiveTab, getArchiveSource, openConversation, openGalleryMap, openMedia } = useArchive();
  const { t, dateLocale } = useLanguage();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [dbStats, setDbStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onThisDay, setOnThisDay] = useState<OnThisDayItem[]>([]);
  const [topChats, setTopChats] = useState<Conversation[]>([]);
  const [placesMedia, setPlacesMedia] = useState<MediaAttachment[]>([]);
  const [placesCount, setPlacesCount] = useState(0);
  const { places: visitedPlaces, namingRemaining } = useVisitedPlaces(placesMedia);

  const primarySource = stats?.platform ? getArchiveSource(stats.platform) : null;
  const archiveName =
    (primarySource && (primarySource.kind === 'zip' ? primarySource.file.name : primarySource.name)) ||
    stats?.archives[stats.platform ?? 'facebook']?.zipFileName ||
    '';
  const displayUsername =
    profile?.username ||
    (archiveName.match(/^instagram-([^/\\]+?)-\d{4}/i)?.[1] ?? '');

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

  useEffect(() => {
    let cancelled = false;
    const loadMemories = async () => {
      const [day, chats, mediaRows] = await Promise.all([
        loadOnThisDay(8),
        loadTopConversations(6),
        db.media.toArray()
      ]);
      if (!cancelled) {
        setOnThisDay(day);
        setTopChats(chats);
        const geotagged = mediaRows.filter(hasGpsCoords);
        setPlacesCount(geotagged.length);
        setPlacesMedia(geotagged);
      }
    };
    void loadMemories();
    return () => {
      cancelled = true;
    };
  }, [stats]);

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
    <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 max-w-6xl mx-auto pb-[calc(3.5rem+env(safe-area-inset-bottom,0px)+1rem)] md:pb-8">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

        <button
          type="button"
          onClick={() => openGalleryMap()}
          className="bg-white p-5 border border-ink-200 rounded-md flex items-center gap-4 hover:border-brand-500 hover:bg-brand-50 transition-colors text-left group"
        >
          <div className="w-10 h-10 border border-ink-200 text-ink-600 flex items-center justify-center shrink-0 group-hover:border-brand-400 group-hover:text-brand-600 transition-colors">
            <MapPin size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-ink-400 font-semibold uppercase tracking-wider mb-0.5">{t('dashboard.places')}</p>
            <h3 className="font-display text-2xl font-semibold text-ink-950">{visitedPlaces.length.toLocaleString(dateLocale)}</h3>
          </div>
          <ArrowRight size={16} className="text-ink-300 group-hover:text-brand-600 shrink-0 transition-colors" />
        </button>
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
                    archiveSource={primarySource}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-6 border border-ink-200 rounded-md">
          <h3 className="font-display text-lg font-semibold text-ink-950 mb-1">{t('dashboard.onThisDay')}</h3>
          {onThisDay.length === 0 ? (
            <p className="text-sm text-ink-400 mt-3">{t('dashboard.onThisDayEmpty')}</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {onThisDay.map((item) => {
                if (item.kind === 'message') {
                  const msg = item.message;
                  return (
                    <li key={msg.id}>
                      <button
                        type="button"
                        onClick={() => openConversation(msg.conversationId, msg.id)}
                        className="w-full text-left"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-700">
                          {yearsAgoLabel(msg.timestamp, t)}
                        </p>
                        <p className="text-[11px] font-semibold text-ink-500 mt-0.5">
                          {msg.isFromUser ? t('dashboard.you') : msg.senderName}
                        </p>
                        <p className="text-sm text-ink-800 line-clamp-2 mt-0.5">{msg.content}</p>
                      </button>
                    </li>
                  );
                }

                const media = item.media;
                return (
                  <li key={media.id}>
                    <button
                      type="button"
                      onClick={() => openMedia(media.id)}
                      className="w-full flex items-center gap-3 text-left"
                    >
                      <OnThisDayMediaThumb
                        item={media}
                        archiveSource={getArchiveSource(media.platform)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-700">
                          {yearsAgoLabel(media.timestamp, t)}
                        </p>
                        <p className="text-sm text-ink-800 mt-0.5">
                          {mediaTypeLabel(media.type, t)}
                          <span className="text-ink-400"> · {t(mediaSourceKey(media.source))}</span>
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-white p-6 border border-ink-200 rounded-md">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h3 className="font-display text-lg font-semibold text-ink-950">{t('dashboard.placesTitle')}</h3>
              <p className="text-xs text-ink-400 mt-0.5">{t('dashboard.placesSubtitle')}</p>
            </div>
            <MapPin size={18} className="text-brand-600 shrink-0 mt-1" />
          </div>
          {placesCount === 0 ? (
            <p className="text-sm text-ink-400 mt-3">{t('dashboard.placesEmpty')}</p>
          ) : (
            <div className="mt-4 space-y-3">
              <PlacesMap items={placesMedia.slice(0, 200)} compact className="rounded-md" />
              <VisitedPlacesList
                places={visitedPlaces}
                namingRemaining={namingRemaining}
                onSelect={(place) =>
                  openGalleryMap({
                    latitude: place.latitude,
                    longitude: place.longitude,
                    placeId: place.id
                  })
                }
              />
              <button
                type="button"
                onClick={() => openGalleryMap()}
                className="w-full flex items-center justify-between px-3 py-2.5 border border-ink-200 text-ink-700 text-xs font-semibold transition-colors group hover:border-brand-500 hover:bg-brand-50 hover:text-brand-800"
              >
                <span>{t('dashboard.placesOpen', { count: placesCount })}</span>
                <ArrowRight size={14} className="text-ink-400 group-hover:text-brand-600 transition-colors" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 border border-ink-200 rounded-md">
        <h3 className="font-display text-lg font-semibold text-ink-950 mb-1">{t('dashboard.topChats')}</h3>
        {topChats.length === 0 ? (
          <p className="text-sm text-ink-400 mt-3">{t('dashboard.topChatsEmpty')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-100">
            {topChats.map((conv) => (
              <li key={conv.id}>
                <button
                  type="button"
                  onClick={() => openConversation(conv.id)}
                  className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-ink-50"
                >
                  <span className="text-sm font-semibold text-ink-900 truncate">{conv.title}</span>
                  <span className="text-[11px] text-ink-400 font-semibold shrink-0">
                    {t('messages.messagesCount', { count: conv.messageCount.toLocaleString(dateLocale) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
