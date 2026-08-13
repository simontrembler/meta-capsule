import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../db/db';
import type { MediaAttachment, MediaSource } from '../db/models';
import { getMediaBlobUrl, type MediaArchiveSource } from '../utils/zipMediaResolver';
import {
  Image as ImageIcon,
  Film,
  FileText,
  AlertCircle,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
  MessageSquare,
  LayoutGrid
} from 'lucide-react';

type SourceFilter = 'all' | MediaSource;
type TypeFilter = 'all' | 'photo' | 'video' | 'audio';
type PlatformFilter = 'all' | 'facebook' | 'instagram';
type MonthFilter = 'all' | string; // 'YYYY-MM'

function monthKeyFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key: string, dateLocale: string): string {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const labelRaw = date.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
  return labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);
}

function sourceLabelKey(source: MediaSource | undefined): 'post' | 'story' | 'message' | 'other' {
  return source ?? 'other';
}

function getSourceLabel(
  t: (key: 'gallery.sourceLabel.post' | 'gallery.sourceLabel.story' | 'gallery.sourceLabel.message' | 'gallery.sourceLabel.other') => string,
  source: MediaSource | undefined
): string {
  switch (sourceLabelKey(source)) {
    case 'post':
      return t('gallery.sourceLabel.post');
    case 'story':
      return t('gallery.sourceLabel.story');
    case 'message':
      return t('gallery.sourceLabel.message');
    default:
      return t('gallery.sourceLabel.other');
  }
}

function inferSourceFromPath(relativePath: string): MediaSource {
  const path = relativePath.replace(/\\/g, '/').toLowerCase();
  if (path.includes('/messages/') || path.includes('messages/inbox') || path.includes('message_requests')) {
    return 'message';
  }
  if (path.includes('/stories/') || path.includes('/media/stories')) return 'story';
  if (path.includes('/media/posts') || path.includes('/posts/')) return 'post';
  return 'other';
}

function withSource(item: MediaAttachment): MediaAttachment {
  return {
    ...item,
    source: item.source || inferSourceFromPath(item.relativePath)
  };
}

function sourceBadgeClass(source: MediaSource | undefined): string {
  // Option 1 — Graphite + cuivre (opaque fills)
  switch (source) {
    case 'post':
      return 'bg-[#1C1B1A] text-[#F7F1EA]';
    case 'story':
      return 'bg-[#433F3B] text-[#F7F1EA]';
    case 'message':
      return 'bg-[#9A6B3F] text-white';
    default:
      return 'bg-[#6F6A63] text-white';
  }
}

function platformChipActiveClass(platform: 'facebook' | 'instagram'): string {
  if (platform === 'facebook') return 'bg-blue-600 text-white';
  return 'bg-gradient-to-tr from-amber-500 via-red-500 to-purple-600 text-white';
}

const GalleryItem: React.FC<{
  item: MediaAttachment;
  archiveSource: MediaArchiveSource | File | null;
  onClick: () => void;
}> = ({ item, archiveSource, onClick }) => {
  const { t } = useLanguage();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !archiveSource) return;

    let isMounted = true;
    const resolveMedia = async () => {
      try {
        setIsLoading(true);
        const url = await getMediaBlobUrl(archiveSource, item.relativePath);
        if (isMounted) {
          setBlobUrl(url);
          setError(false);
        }
      } catch (err) {
        console.error('Failed to resolve gallery media:', err);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void resolveMedia();
    return () => {
      isMounted = false;
    };
  }, [isVisible, item.relativePath, archiveSource]);

  return (
    <div
      ref={rootRef}
      onClick={onClick}
      className="aspect-square rounded-md overflow-hidden border border-ink-200 bg-ink-100 group cursor-pointer relative transition-opacity hover:opacity-90"
    >
      {!archiveSource ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
          <AlertCircle size={18} className="text-brand-600 mb-1" />
          <span className="text-[10px] text-ink-500 font-semibold leading-tight">{t('gallery.zipMissing')}</span>
        </div>
      ) : isLoading || (!blobUrl && !error && isVisible) ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-ink-300 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-red-50">
          <AlertCircle size={18} className="text-red-500 mb-1" />
          <span className="text-[10px] text-red-600 font-bold leading-tight">{t('common.error')}</span>
        </div>
      ) : !blobUrl ? (
        <div className="w-full h-full bg-ink-200" />
      ) : item.type === 'photo' ? (
        <img src={blobUrl} alt="Gallery" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
      ) : item.type === 'video' ? (
        <div className="w-full h-full relative bg-ink-950">
          <video src={blobUrl} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-10 h-10 rounded-full bg-white/90 text-ink-800 flex items-center justify-center">
              <Film size={18} />
            </div>
          </div>
        </div>
      ) : item.type === 'audio' ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-ink-100 p-3 text-center gap-2">
          <div className="w-10 h-10 rounded-full bg-ink-200 text-ink-700 flex items-center justify-center">
            <MessageSquare size={18} />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-700">{t('gallery.voice')}</span>
          <audio src={blobUrl} controls preload="none" className="w-full h-8" onClick={(e) => e.stopPropagation()} />
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-ink-50 p-4 text-center">
          <FileText size={32} className="text-brand-600 mb-2" />
          <span className="text-xs font-bold text-ink-800 truncate w-full">
            {item.relativePath.split('/').pop()}
          </span>
        </div>
      )}

      <div className="absolute top-2 left-2 z-10">
        <span
          className={`inline-block px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider shadow-none ${sourceBadgeClass(item.source)}`}
        >
          {getSourceLabel(t, item.source)}
        </span>
      </div>
    </div>
  );
};

export const GalleryModule: React.FC = () => {
  const { getArchiveSource } = useArchive();
  const { t, dateLocale } = useLanguage();
  const [allMedia, setAllMedia] = useState<MediaAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [monthFilter, setMonthFilter] = useState<MonthFilter>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxBlobUrl, setLightboxBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const rows = await db.media.orderBy('timestamp').reverse().toArray();
        if (!cancelled) {
          setAllMedia(rows.map(withSource));
        }
      } catch (err) {
        console.error('Error loading gallery media:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    return allMedia.filter((item) => {
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (platformFilter !== 'all' && item.platform !== platformFilter) return false;
      if (monthFilter !== 'all' && monthKeyFromTimestamp(item.timestamp) !== monthFilter) return false;
      return true;
    });
  }, [allMedia, monthFilter, platformFilter, sourceFilter, typeFilter]);

  // Months available for the current origin / type / platform (month filter excluded)
  const monthOptions = useMemo(() => {
    const countsByMonth = new Map<string, number>();
    for (const item of allMedia) {
      if (!item.timestamp) continue;
      if (sourceFilter !== 'all' && item.source !== sourceFilter) continue;
      if (typeFilter !== 'all' && item.type !== typeFilter) continue;
      if (platformFilter !== 'all' && item.platform !== platformFilter) continue;
      const key = monthKeyFromTimestamp(item.timestamp);
      countsByMonth.set(key, (countsByMonth.get(key) || 0) + 1);
    }
    return Array.from(countsByMonth.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, count]) => ({
        key,
        label: formatMonthLabel(key, dateLocale),
        count
      }));
  }, [allMedia, dateLocale, platformFilter, sourceFilter, typeFilter]);

  // If selected month disappears after another filter change, reset to all
  useEffect(() => {
    if (monthFilter === 'all') return;
    if (!monthOptions.some((opt) => opt.key === monthFilter)) {
      setMonthFilter('all');
    }
  }, [monthFilter, monthOptions]);

  const mediaGroups = useMemo(() => {
    const groups: { key: string; label: string; items: MediaAttachment[] }[] = [];
    const index = new Map<string, MediaAttachment[]>();

    for (const item of filteredItems) {
      const key = monthKeyFromTimestamp(item.timestamp);
      if (!index.has(key)) {
        index.set(key, []);
        groups.push({ key, label: formatMonthLabel(key, dateLocale), items: index.get(key)! });
      }
      index.get(key)!.push(item);
    }

    return groups;
  }, [filteredItems, dateLocale]);

  const counts = useMemo(() => {
    const base = { post: 0, story: 0, message: 0, other: 0, photo: 0, video: 0, audio: 0, total: allMedia.length };
    for (const item of allMedia) {
      base[item.source || 'other'] += 1;
      if (item.type === 'photo' || item.type === 'video' || item.type === 'audio') {
        base[item.type] += 1;
      }
    }
    return base;
  }, [allMedia]);

  const openLightbox = async (index: number) => {
    setLightboxIndex(index);
    const item = filteredItems[index];
    const source = item ? getArchiveSource(item.platform) : null;
    if (source && item) {
      try {
        setLightboxBlobUrl(await getMediaBlobUrl(source, item.relativePath));
      } catch (err) {
        console.error('Failed to open lightbox media:', err);
      }
    }
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    setLightboxBlobUrl(null);
  };

  const navigateLightbox = async (direction: 'prev' | 'next') => {
    if (lightboxIndex === null) return;
    let newIndex = direction === 'prev' ? lightboxIndex - 1 : lightboxIndex + 1;
    if (newIndex < 0) newIndex = filteredItems.length - 1;
    if (newIndex >= filteredItems.length) newIndex = 0;
    setLightboxIndex(newIndex);
    setLightboxBlobUrl(null);
    const item = filteredItems[newIndex];
    const source = item ? getArchiveSource(item.platform) : null;
    if (source && item) {
      try {
        setLightboxBlobUrl(await getMediaBlobUrl(source, item.relativePath));
      } catch (err) {
        console.error('Failed to navigate lightbox media:', err);
      }
    }
  };

  const chip = (
    active: boolean,
    onClick: () => void,
    label: string,
    activeClass = 'bg-[#1C1B1A] text-[#F7F1EA]'
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
        active
          ? activeClass
          : 'text-ink-700 hover:text-ink-950 hover:bg-ink-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-4 max-w-6xl mx-auto h-[calc(100dvh-3.5rem)] md:h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <div className="bg-white p-3 sm:p-4 border border-ink-200 rounded-md space-y-3 shrink-0">
        <div className="flex items-center gap-2 text-ink-800">
          <Filter size={18} className="text-brand-600 shrink-0" />
          <span className="font-semibold text-sm">{t('common.filters')}</span>
          <span className="text-xs text-ink-400 font-medium truncate">
            {isLoading
              ? t('common.loading')
              : t('gallery.loaded', {
                  filtered: filteredItems.length,
                  total: counts.total,
                  months: mediaGroups.length
                })}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-ink-400">
              <LayoutGrid size={12} /> {t('gallery.origin')}
            </div>
            <div className="flex border border-ink-200 p-0.5 overflow-x-auto max-w-full">
              {chip(sourceFilter === 'all', () => setSourceFilter('all'), t('gallery.source.all', { count: counts.total }))}
              {chip(sourceFilter === 'post', () => setSourceFilter('post'), t('gallery.source.post', { count: counts.post }))}
              {chip(sourceFilter === 'story', () => setSourceFilter('story'), t('gallery.source.story', { count: counts.story }))}
              {chip(sourceFilter === 'message', () => setSourceFilter('message'), t('gallery.source.message', { count: counts.message }))}
            </div>
          </div>

          <div className="flex border border-ink-200 p-0.5 overflow-x-auto max-w-full">
            {chip(typeFilter === 'all', () => setTypeFilter('all'), t('gallery.type.all'))}
            {chip(typeFilter === 'photo', () => setTypeFilter('photo'), t('gallery.type.photo', { count: counts.photo }))}
            {chip(typeFilter === 'video', () => setTypeFilter('video'), t('gallery.type.video', { count: counts.video }))}
            {chip(typeFilter === 'audio', () => setTypeFilter('audio'), t('gallery.type.audio', { count: counts.audio }))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <label
              htmlFor="gallery-month-filter"
              className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-ink-400 shrink-0"
            >
              <Calendar size={12} /> {t('gallery.period')}
            </label>
            <select
              id="gallery-month-filter"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value as MonthFilter)}
              className="w-full sm:w-auto min-w-[14rem] max-w-full px-3 py-2 text-xs font-semibold bg-ink-50 border border-ink-200 rounded-md text-ink-900 outline-none focus:border-brand-500"
            >
              <option value="all">{t('gallery.period.all')}</option>
              {monthOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label} ({opt.count})
                </option>
              ))}
            </select>
          </div>

          <div className="flex border border-ink-200 p-0.5 overflow-x-auto max-w-full self-start">
            {chip(platformFilter === 'all', () => setPlatformFilter('all'), t('gallery.platform.all'))}
            {chip(
              platformFilter === 'facebook',
              () => setPlatformFilter('facebook'),
              'Facebook',
              platformChipActiveClass('facebook')
            )}
            {chip(
              platformFilter === 'instagram',
              () => setPlatformFilter('instagram'),
              'Instagram',
              platformChipActiveClass('instagram')
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-8">
        {filteredItems.length > 0 ? (
          mediaGroups.map((group) => (
            <div key={group.key} className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-ink-200">
                <Calendar size={16} className="text-brand-600" />
                <h3 className="font-display font-semibold text-ink-950 text-base">{group.label}</h3>
                <span className="text-xs text-ink-400 font-semibold">
                  ({t('gallery.mediaCount', { count: group.items.length })})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {group.items.map((item) => {
                  const globalIndex = filteredItems.findIndex((fi) => fi.id === item.id);
                  return (
                    <GalleryItem
                      key={item.id}
                      item={item}
                      archiveSource={getArchiveSource(item.platform)}
                      onClick={() => openLightbox(globalIndex)}
                    />
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-md border border-ink-200">
            <ImageIcon size={48} className="text-ink-300 mx-auto mb-3" />
            <h3 className="font-display text-lg font-semibold text-ink-800 mb-1">{t('gallery.emptyTitle')}</h3>
            <p className="text-ink-400 text-sm max-w-sm mx-auto">
              {isLoading ? t('gallery.emptyLoading') : t('gallery.emptyHint')}
            </p>
          </div>
        )}
      </div>

      {lightboxIndex !== null && filteredItems[lightboxIndex] && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col justify-between p-3 sm:p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-400 font-bold uppercase tracking-wider">
                {getSourceLabel(t, filteredItems[lightboxIndex].source)} •{' '}
                {filteredItems[lightboxIndex].platform} •{' '}
                {new Date(filteredItems[lightboxIndex].timestamp).toLocaleDateString(dateLocale, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
              <span className="text-[10px] text-ink-500 font-semibold truncate max-w-md">
                {filteredItems[lightboxIndex].relativePath}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {lightboxBlobUrl && (
                <a
                  href={lightboxBlobUrl}
                  download={filteredItems[lightboxIndex].relativePath.split('/').pop()}
                  className="p-2.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-2 text-xs font-bold"
                >
                  <Download size={16} />
                  <span>{t('common.export')}</span>
                </a>
              )}
              <button
                onClick={closeLightbox}
                className="p-2.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-between gap-4 my-4">
            <button
              onClick={() => navigateLightbox('prev')}
              className="p-3 rounded-full bg-white/5 hover:bg-white/15 text-white/80 hover:text-white transition-all shrink-0"
            >
              <ChevronLeft size={28} />
            </button>

            <div className="flex-1 max-h-[70vh] flex items-center justify-center">
              {!getArchiveSource(filteredItems[lightboxIndex].platform) ? (
                <div className="text-center space-y-2">
                  <AlertCircle size={48} className="text-brand-400 mx-auto" />
                  <p className="font-bold text-lg">{t('gallery.zipMissingMemory')}</p>
                </div>
              ) : !lightboxBlobUrl ? (
                <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              ) : filteredItems[lightboxIndex].type === 'photo' ? (
                <img
                  src={lightboxBlobUrl}
                  alt="Lightbox"
                  className="max-w-full max-h-[70vh] object-contain"
                />
              ) : filteredItems[lightboxIndex].type === 'video' ? (
                <video
                  src={lightboxBlobUrl}
                  controls
                  autoPlay
                  className="max-w-full max-h-[70vh]"
                />
              ) : (
                <div className="text-center space-y-4">
                  <FileText size={64} className="text-brand-400 mx-auto" />
                  <p className="font-bold text-lg">
                    {filteredItems[lightboxIndex].relativePath.split('/').pop()}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => navigateLightbox('next')}
              className="p-3 rounded-full bg-white/5 hover:bg-white/15 text-white/80 hover:text-white transition-all shrink-0"
            >
              <ChevronRight size={28} />
            </button>
          </div>

          <div className="text-center text-xs text-ink-500 font-bold uppercase tracking-wider flex items-center justify-center gap-2">
            {filteredItems[lightboxIndex].source === 'message' && <MessageSquare size={12} />}
            {lightboxIndex + 1} / {filteredItems.length}
          </div>
        </div>
      )}
    </div>
  );
};
