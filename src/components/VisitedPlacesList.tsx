import React from 'react';
import { MapPin } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { fallbackPlaceLabel, type VisitedPlace } from '../utils/places';

type VisitedPlacesListProps = {
  places: VisitedPlace[];
  namingRemaining: number;
  onSelect: (place: VisitedPlace) => void;
  selectedId?: string | null;
  className?: string;
  listClassName?: string;
};

function formatRange(first: number, last: number, dateLocale: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const a = new Date(first).toLocaleDateString(dateLocale, opts);
  const b = new Date(last).toLocaleDateString(dateLocale, opts);
  return a === b ? a : `${a} – ${b}`;
}

export const VisitedPlacesList: React.FC<VisitedPlacesListProps> = ({
  places,
  namingRemaining,
  onSelect,
  selectedId,
  className = '',
  listClassName = 'max-h-56'
}) => {
  const { t, dateLocale } = useLanguage();

  if (places.length === 0) return null;

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500">
          {t('places.listTitle', { count: places.length })}
        </h4>
        {namingRemaining > 0 && (
          <p className="text-[10px] text-ink-400">{t('places.naming')}</p>
        )}
      </div>
      <ul className={`divide-y divide-ink-100 overflow-y-auto border border-ink-100 ${listClassName}`}>
        {places.map((place) => {
          const selected = selectedId === place.id;
          const name =
            place.label ||
            t('places.unnamed', { coords: fallbackPlaceLabel(place.latitude, place.longitude) });
          return (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => onSelect(place)}
                className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors ${
                  selected ? 'bg-brand-50' : 'hover:bg-ink-50'
                }`}
              >
                <MapPin
                  size={14}
                  className={`shrink-0 mt-0.5 ${selected ? 'text-brand-700' : 'text-brand-600'}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink-900 truncate">{name}</span>
                  <span className="block text-[11px] text-ink-400 mt-0.5">
                    {t('places.mediaCount', { count: place.mediaCount })}
                    {' · '}
                    {formatRange(place.firstTimestamp, place.lastTimestamp, dateLocale)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
