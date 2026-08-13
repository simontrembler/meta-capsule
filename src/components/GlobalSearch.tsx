import React, { useEffect, useRef, useState } from 'react';
import { FileText, MessageSquare, Search, X } from 'lucide-react';
import { useArchive } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { searchCapsule, type GlobalSearchHit } from '../utils/capsuleSearch';

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ open, onClose }) => {
  const { openConversation, openMedia } = useArchive();
  const { t, dateLocale } = useLanguage();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHits([]);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = window.setTimeout(() => {
      void searchCapsule(trimmed).then((results) => {
        if (!cancelled) {
          setHits(results);
          setIsSearching(false);
        }
      });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  if (!open) return null;

  const openHit = (hit: GlobalSearchHit) => {
    if (hit.kind === 'message') {
      openConversation(hit.conversationId, hit.messageId);
      onClose();
      return;
    }
    if (hit.mediaId) {
      openMedia(hit.mediaId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-ink-950/50 px-3 pt-[12vh]" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white border border-ink-200 rounded-md shadow-lg overflow-hidden"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('search.globalTitle')}
      >
        <div className="flex items-center gap-2 border-b border-ink-200 px-3">
          <Search size={16} className="text-ink-400 shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent py-3 text-sm font-semibold text-ink-900 outline-none"
          />
          <kbd className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-ink-400 border border-ink-200 px-1.5 py-0.5">
            esc
          </kbd>
          <button type="button" onClick={onClose} className="p-2 text-ink-400 hover:text-ink-800" aria-label={t('search.close')}>
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <p className="px-4 py-6 text-sm text-ink-400">{t('search.hint')}</p>
          ) : isSearching ? (
            <p className="px-4 py-6 text-sm text-ink-400">{t('common.loading')}</p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-400">{t('search.empty')}</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => openHit(hit)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-ink-50"
                  >
                    <span className="mt-0.5 text-brand-600 shrink-0">
                      {hit.kind === 'message' ? <MessageSquare size={16} /> : <FileText size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink-900 truncate">{hit.title}</span>
                        <span className="text-[10px] font-semibold text-ink-400 shrink-0">
                          {new Date(hit.timestamp).toLocaleDateString(dateLocale, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-500 line-clamp-2">{hit.snippet}</span>
                      <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wider text-ink-400">
                        {hit.kind === 'message' ? t('search.kindMessage') : t('search.kindPost')} · {hit.platform}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
