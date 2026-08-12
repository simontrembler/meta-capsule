import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { db } from '../db/db';
import type { MediaAttachment, MediaSource } from '../db/models';
import { getMediaBlobUrl } from '../utils/zipMediaResolver';
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

const SOURCE_LABELS: Record<MediaSource, string> = {
  post: 'Publication',
  story: 'Story',
  message: 'Message',
  other: 'Autre'
};

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
  switch (source) {
    case 'post':
      return 'bg-brand-600';
    case 'story':
      return 'bg-violet-600';
    case 'message':
      return 'bg-sky-600';
    default:
      return 'bg-slate-600';
  }
}

const GalleryItem: React.FC<{
  item: MediaAttachment;
  zipFile: File | null;
  onClick: () => void;
}> = ({ item, zipFile, onClick }) => {
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
    if (!isVisible || !zipFile) return;

    let isMounted = true;
    const resolveMedia = async () => {
      try {
        setIsLoading(true);
        const url = await getMediaBlobUrl(zipFile, item.relativePath);
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
  }, [isVisible, item.relativePath, zipFile]);

  return (
    <div
      ref={rootRef}
      onClick={onClick}
      className="aspect-square rounded-xl overflow-hidden border border-slate-200/60 bg-slate-100 group cursor-pointer relative shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-150"
    >
      {!zipFile ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
          <AlertCircle size={18} className="text-amber-500 mb-1" />
          <span className="text-[10px] text-slate-500 font-bold leading-tight">ZIP non chargé</span>
        </div>
      ) : isLoading || (!blobUrl && !error && isVisible) ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-red-50">
          <AlertCircle size={18} className="text-red-500 mb-1" />
          <span className="text-[10px] text-red-600 font-bold leading-tight">Erreur</span>
        </div>
      ) : !blobUrl ? (
        <div className="w-full h-full bg-slate-200/70" />
      ) : item.type === 'photo' ? (
        <img src={blobUrl} alt="Gallery" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
      ) : item.type === 'video' ? (
        <div className="w-full h-full relative bg-slate-900">
          <video src={blobUrl} className="w-full h-full object-cover" muted playsInline />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-10 h-10 rounded-full bg-white/90 text-brand-600 flex items-center justify-center shadow-md">
              <Film size={18} />
            </div>
          </div>
        </div>
      ) : item.type === 'audio' ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-sky-50 p-3 text-center gap-2">
          <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center">
            <MessageSquare size={18} />
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700">Vocal</span>
          <audio src={blobUrl} controls preload="none" className="w-full h-8" onClick={(e) => e.stopPropagation()} />
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
          <FileText size={32} className="text-brand-600 mb-2" />
          <span className="text-xs font-bold text-slate-700 truncate w-full">
            {item.relativePath.split('/').pop()}
          </span>
        </div>
      )}

      <div className="absolute top-2 left-2">
        <span
          className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider text-white shadow-md ${sourceBadgeClass(item.source)}`}
        >
          {SOURCE_LABELS[item.source || 'other']}
        </span>
      </div>
    </div>
  );
};

export const GalleryModule: React.FC = () => {
  const { zipFile } = useArchive();
  const [allMedia, setAllMedia] = useState<MediaAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
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
      return true;
    });
  }, [allMedia, platformFilter, sourceFilter, typeFilter]);

  const mediaGroups = useMemo(() => {
    const groups: { key: string; label: string; items: MediaAttachment[] }[] = [];
    const index = new Map<string, MediaAttachment[]>();

    for (const item of filteredItems) {
      const date = new Date(item.timestamp);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!index.has(key)) {
        const labelRaw = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const label = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);
        index.set(key, []);
        groups.push({ key, label, items: index.get(key)! });
      }
      index.get(key)!.push(item);
    }

    return groups;
  }, [filteredItems]);

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
    if (zipFile && item) {
      try {
        setLightboxBlobUrl(await getMediaBlobUrl(zipFile, item.relativePath));
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
    if (zipFile && item) {
      try {
        setLightboxBlobUrl(await getMediaBlobUrl(zipFile, item.relativePath));
      } catch (err) {
        console.error('Failed to navigate lightbox media:', err);
      }
    }
  };

  const chip = (
    active: boolean,
    onClick: () => void,
    label: string,
    activeClass = 'bg-white text-brand-700 shadow-sm'
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
        active ? activeClass : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto h-[calc(100vh-5rem)] flex flex-col overflow-hidden">
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 shrink-0">
        <div className="flex items-center gap-2 text-slate-700">
          <Filter size={18} className="text-brand-600" />
          <span className="font-bold text-sm">Filtres</span>
          <span className="text-xs text-slate-400 font-semibold">
            {isLoading ? 'Chargement…' : `${filteredItems.length} / ${counts.total} médias · ${mediaGroups.length} mois`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mr-1">
            <LayoutGrid size={12} /> Origine
          </div>
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
            {chip(sourceFilter === 'all', () => setSourceFilter('all'), `Tous (${counts.total})`)}
            {chip(sourceFilter === 'post', () => setSourceFilter('post'), `Publications (${counts.post})`)}
            {chip(sourceFilter === 'story', () => setSourceFilter('story'), `Stories (${counts.story})`)}
            {chip(sourceFilter === 'message', () => setSourceFilter('message'), `Messages (${counts.message})`)}
          </div>

          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
            {chip(typeFilter === 'all', () => setTypeFilter('all'), 'Tous types')}
            {chip(typeFilter === 'photo', () => setTypeFilter('photo'), `Photos (${counts.photo})`)}
            {chip(typeFilter === 'video', () => setTypeFilter('video'), `Vidéos (${counts.video})`)}
            {chip(typeFilter === 'audio', () => setTypeFilter('audio'), `Vocaux (${counts.audio})`)}
          </div>

          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
            {chip(platformFilter === 'all', () => setPlatformFilter('all'), 'Toutes plateformes')}
            {chip(
              platformFilter === 'facebook',
              () => setPlatformFilter('facebook'),
              'Facebook',
              'bg-blue-600 text-white shadow-sm'
            )}
            {chip(
              platformFilter === 'instagram',
              () => setPlatformFilter('instagram'),
              'Instagram',
              'bg-gradient-to-tr from-amber-500 via-red-500 to-purple-600 text-white shadow-sm'
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-8">
        {filteredItems.length > 0 ? (
          mediaGroups.map((group) => (
            <div key={group.key} className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Calendar size={16} className="text-brand-600" />
                <h3 className="font-extrabold text-slate-800 text-base">{group.label}</h3>
                <span className="text-xs text-slate-400 font-bold">({group.items.length} médias)</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {group.items.map((item) => {
                  const globalIndex = filteredItems.findIndex((fi) => fi.id === item.id);
                  return (
                    <GalleryItem
                      key={item.id}
                      item={item}
                      zipFile={zipFile}
                      onClick={() => openLightbox(globalIndex)}
                    />
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <ImageIcon size={48} className="text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">Aucun média trouvé</h3>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              {isLoading
                ? 'Chargement de la galerie…'
                : "Aucun média pour ces filtres. Réimportez l'archive pour appliquer les nouvelles dates et origines."}
            </p>
          </div>
        )}
      </div>

      {lightboxIndex !== null && filteredItems[lightboxIndex] && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col justify-between p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {SOURCE_LABELS[filteredItems[lightboxIndex].source || 'other']} •{' '}
                {filteredItems[lightboxIndex].platform} •{' '}
                {new Date(filteredItems[lightboxIndex].timestamp).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold truncate max-w-md">
                {filteredItems[lightboxIndex].relativePath}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {lightboxBlobUrl && (
                <a
                  href={lightboxBlobUrl}
                  download={filteredItems[lightboxIndex].relativePath.split('/').pop()}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-2 text-xs font-bold"
                >
                  <Download size={16} />
                  <span>Exporter</span>
                </a>
              )}
              <button
                onClick={closeLightbox}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
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
              {!zipFile ? (
                <div className="text-center space-y-2">
                  <AlertCircle size={48} className="text-amber-500 mx-auto" />
                  <p className="font-bold text-lg">ZIP non chargé en mémoire</p>
                </div>
              ) : !lightboxBlobUrl ? (
                <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              ) : filteredItems[lightboxIndex].type === 'photo' ? (
                <img
                  src={lightboxBlobUrl}
                  alt="Lightbox"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
                />
              ) : filteredItems[lightboxIndex].type === 'video' ? (
                <video
                  src={lightboxBlobUrl}
                  controls
                  autoPlay
                  className="max-w-full max-h-[70vh] rounded-lg shadow-2xl"
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

          <div className="text-center text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center justify-center gap-2">
            {filteredItems[lightboxIndex].source === 'message' && <MessageSquare size={12} />}
            {lightboxIndex + 1} / {filteredItems.length}
          </div>
        </div>
      )}
    </div>
  );
};
