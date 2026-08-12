import React, { useEffect, useState, useRef } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { db } from '../db/db';
import type { MediaAttachment } from '../db/models';
import { getMediaBlobUrl } from '../utils/zipMediaResolver';
import { Image as ImageIcon, Film, FileText, AlertCircle, X, Download, ChevronLeft, ChevronRight, Filter, Calendar } from 'lucide-react';

// Lazy-loaded media item component for the grid
const GalleryItem: React.FC<{
  item: MediaAttachment;
  zipFile: File | null;
  onClick: () => void;
}> = ({ item, zipFile, onClick }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!zipFile) {
      setIsLoading(false);
      return;
    }

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

    resolveMedia();

    return () => {
      isMounted = false;
    };
  }, [item.relativePath, zipFile]);

  if (!zipFile) {
    return (
      <div className="aspect-square rounded-xl bg-slate-100 flex flex-col items-center justify-center p-3 text-center border border-slate-200">
        <AlertCircle size={18} className="text-amber-500 mb-1" />
        <span className="text-[10px] text-slate-500 font-bold leading-tight">ZIP non chargé</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="aspect-square rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="aspect-square rounded-xl bg-red-50 flex flex-col items-center justify-center p-3 text-center border border-red-100">
        <AlertCircle size={18} className="text-red-500 mb-1" />
        <span className="text-[10px] text-red-600 font-bold leading-tight">Erreur</span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="aspect-square rounded-xl overflow-hidden border border-slate-200/60 bg-slate-900 group cursor-pointer relative shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-150"
    >
      {item.type === 'photo' ? (
        <img src={blobUrl} alt="Gallery" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
      ) : item.type === 'video' ? (
        <div className="w-full h-full relative">
          <video src={blobUrl} className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
            <div className="w-10 h-10 rounded-full bg-white/90 text-brand-600 flex items-center justify-center shadow-md">
              <Film size={18} />
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
          <FileText size={32} className="text-brand-600 mb-2" />
          <span className="text-xs font-bold text-slate-700 truncate w-full">{item.relativePath.split('/').pop()}</span>
        </div>
      )}

      {/* Platform badge on hover */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider text-white shadow-md ${
          item.platform === 'facebook' ? 'bg-blue-600' : 'bg-gradient-to-tr from-amber-500 via-red-500 to-purple-600'
        }`}>
          {item.platform}
        </span>
      </div>
    </div>
  );
};

export const GalleryModule: React.FC = () => {
  const { zipFile } = useArchive();
  const [mediaItems, setMediaItems] = useState<MediaAttachment[]>([]);
  const [filteredItems, setFilteredItems] = useState<MediaAttachment[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'photo' | 'video'>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'facebook' | 'instagram'>('all');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Lightbox State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxBlobUrl, setLightboxBlobUrl] = useState<string | null>(null);

  const observerTarget = useRef<HTMLDivElement>(null);

  // 1. Load media items from database
  const loadMedia = async (reset = false) => {
    if (isLoading) return;
    setIsLoading(true);

    const currentPage = reset ? 1 : page;
    const limit = 60;
    const offset = (currentPage - 1) * limit;

    try {
      let query: any = db.media;

      // Apply filters at database level if possible, or filter in memory
      // Since we want to sort by timestamp desc, we can use orderBy
      const fetched = await query
        .orderBy('timestamp')
        .reverse()
        .offset(offset)
        .limit(limit)
        .toArray();

      if (reset) {
        setMediaItems(fetched);
        setPage(2);
        setHasMore(fetched.length === limit);
      } else {
        setMediaItems(prev => [...prev, ...fetched]);
        setPage(prev => prev + 1);
        setHasMore(fetched.length === limit);
      }
    } catch (err) {
      console.error('Error loading gallery media:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMedia(true);
  }, []);

  // 2. Filter items in memory based on filters
  useEffect(() => {
    let items = mediaItems;

    if (typeFilter !== 'all') {
      items = items.filter(item => item.type === typeFilter);
    }

    if (platformFilter !== 'all') {
      items = items.filter(item => item.platform === platformFilter);
    }

    setFilteredItems(items);
  }, [mediaItems, typeFilter, platformFilter]);

  // 3. Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMedia();
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, page]);

  // 4. Lightbox Navigation
  const openLightbox = async (index: number) => {
    setLightboxIndex(index);
    const item = filteredItems[index];
    if (zipFile && item) {
      try {
        const url = await getMediaBlobUrl(zipFile, item.relativePath);
        setLightboxBlobUrl(url);
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
    setLightboxBlobUrl(null); // Clear previous

    const item = filteredItems[newIndex];
    if (zipFile && item) {
      try {
        const url = await getMediaBlobUrl(zipFile, item.relativePath);
        setLightboxBlobUrl(url);
      } catch (err) {
        console.error('Failed to navigate lightbox media:', err);
      }
    }
  };

  // 5. Group filtered items by Month/Year
  const groupMediaByMonth = () => {
    const groups: { [key: string]: MediaAttachment[] } = {};
    filteredItems.forEach(item => {
      const date = new Date(item.timestamp);
      const monthYear = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const capitalized = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
      if (!groups[capitalized]) {
        groups[capitalized] = [];
      }
      groups[capitalized].push(item);
    });
    return groups;
  };

  const mediaGroups = groupMediaByMonth();

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto h-[calc(100vh-5rem)] flex flex-col overflow-hidden">
      
      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 text-slate-700">
          <Filter size={18} className="text-brand-600" />
          <span className="font-bold text-sm">Filtres :</span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Type Filter */}
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'all'
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setTypeFilter('photo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'photo'
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Photos
            </button>
            <button
              onClick={() => setTypeFilter('video')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                typeFilter === 'video'
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Vidéos
            </button>
          </div>

          {/* Platform Filter */}
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
            <button
              onClick={() => setPlatformFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                platformFilter === 'all'
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Toutes plateformes
            </button>
            <button
              onClick={() => setPlatformFilter('facebook')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                platformFilter === 'facebook'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Facebook
            </button>
            <button
              onClick={() => setPlatformFilter('instagram')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                platformFilter === 'instagram'
                  ? 'bg-gradient-to-tr from-amber-500 via-red-500 to-purple-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Instagram
            </button>
          </div>
        </div>
      </div>

      {/* Gallery Grid Container */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-8">
        {filteredItems.length > 0 ? (
          Object.entries(mediaGroups).map(([monthYear, items]) => (
            <div key={monthYear} className="space-y-4">
              {/* Group Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Calendar size={16} className="text-brand-600" />
                <h3 className="font-extrabold text-slate-800 text-base">{monthYear}</h3>
                <span className="text-xs text-slate-400 font-bold">({items.length} médias)</span>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {items.map((item) => {
                  // Find index in filteredItems for lightbox navigation
                  const globalIndex = filteredItems.findIndex(fi => fi.id === item.id);
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
              Nous n'avons pas trouvé d'images ou de vidéos correspondant à vos critères dans cette archive.
            </p>
          </div>
        )}

        {/* Infinite Scroll Target */}
        <div ref={observerTarget} className="h-10 flex items-center justify-center">
          {isLoading && (
            <div className="w-6 h-6 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && filteredItems[lightboxIndex] && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col justify-between p-6 text-white animate-fade-in">
          {/* Lightbox Header */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {filteredItems[lightboxIndex].platform} • {new Date(filteredItems[lightboxIndex].timestamp).toLocaleDateString('fr-FR', {
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
                  title="Télécharger ce média"
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

          {/* Lightbox Main Content */}
          <div className="flex-1 flex items-center justify-between gap-4 my-4">
            {/* Prev Button */}
            <button
              onClick={() => navigateLightbox('prev')}
              className="p-3 rounded-full bg-white/5 hover:bg-white/15 text-white/80 hover:text-white transition-all shrink-0"
            >
              <ChevronLeft size={28} />
            </button>

            {/* Media Display */}
            <div className="flex-1 max-h-[70vh] flex items-center justify-center">
              {!zipFile ? (
                <div className="text-center space-y-2">
                  <AlertCircle size={48} className="text-amber-500 mx-auto" />
                  <p className="font-bold text-lg">ZIP non chargé en mémoire</p>
                  <p className="text-sm text-slate-400 max-w-xs">
                    Veuillez charger le fichier ZIP d'origine depuis l'en-tête de l'application pour voir ce média.
                  </p>
                </div>
              ) : !lightboxBlobUrl ? (
                <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
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
                  <p className="font-bold text-lg">{filteredItems[lightboxIndex].relativePath.split('/').pop()}</p>
                </div>
              )}
            </div>

            {/* Next Button */}
            <button
              onClick={() => navigateLightbox('next')}
              className="p-3 rounded-full bg-white/5 hover:bg-white/15 text-white/80 hover:text-white transition-all shrink-0"
            >
              <ChevronRight size={28} />
            </button>
          </div>

          {/* Lightbox Footer */}
          <div className="text-center text-xs text-slate-500 font-bold uppercase tracking-wider">
            {lightboxIndex + 1} / {filteredItems.length}
          </div>
        </div>
      )}
    </div>
  );
};
