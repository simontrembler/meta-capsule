import React, { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { MediaAttachment } from '../db/models';
import { useLanguage } from '../context/LanguageContext';
import { hasGpsCoords } from '../utils/places';
import 'leaflet/dist/leaflet.css';

export { hasGpsCoords };

export type MapFocus = {
  latitude: number;
  longitude: number;
};

type PlacesMapProps = {
  items: MediaAttachment[];
  className?: string;
  /** Compact preview (dashboard) — no popups, lighter chrome */
  compact?: boolean;
  /** Hide the OSM/network hint strip (e.g. mobile map chrome) */
  hideTilesHint?: boolean;
  onSelect?: (item: MediaAttachment) => void;
  focus?: MapFocus | null;
};

function FitToPoints({
  positions,
  hasFocus
}: {
  positions: [number, number][];
  hasFocus: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (hasFocus || positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 11);
      return;
    }
    map.fitBounds(positions, { padding: [28, 28], maxZoom: 13 });
  }, [map, positions, hasFocus]);
  return null;
}

function FlyToFocus({ focus }: { focus: MapFocus | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    const id = window.setTimeout(() => {
      map.flyTo([focus.latitude, focus.longitude], 14, { duration: 0.65 });
    }, 50);
    return () => window.clearTimeout(id);
  }, [map, focus]);
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export const PlacesMap: React.FC<PlacesMapProps> = ({
  items,
  className = '',
  compact = false,
  hideTilesHint = false,
  onSelect,
  focus
}) => {
  const { t, dateLocale } = useLanguage();

  const geotagged = useMemo(() => items.filter(hasGpsCoords), [items]);
  const positions = useMemo(
    () => geotagged.map((m) => [m.latitude, m.longitude] as [number, number]),
    [geotagged]
  );

  if (geotagged.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center border border-ink-200 bg-ink-50/80 px-4 py-10 text-center ${className}`}
      >
        <p className="font-display text-sm font-semibold text-ink-800">{t('map.emptyTitle')}</p>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-400">{t('map.emptyHint')}</p>
      </div>
    );
  }

  const center = focus ? ([focus.latitude, focus.longitude] as [number, number]) : positions[0];

  return (
    <div className={`relative z-0 isolate flex flex-col overflow-hidden border border-ink-200 bg-white ${className}`}>
      {!compact && !hideTilesHint && (
        <p className="shrink-0 border-b border-ink-100 bg-ink-50/90 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
          {t('map.tilesHint')}
        </p>
      )}
      <MapContainer
        center={center}
        zoom={focus ? 14 : 3}
        scrollWheelZoom={!compact}
        dragging={!compact || geotagged.length > 0}
        className={compact ? 'h-40 w-full' : 'h-full min-h-[280px] w-full flex-1'}
        style={{ background: '#E8E5DF' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToPoints positions={positions} hasFocus={Boolean(focus)} />
        <FlyToFocus focus={focus} />
        <InvalidateOnResize />
        {geotagged.map((item) => (
          <CircleMarker
            key={item.id}
            center={[item.latitude, item.longitude]}
            radius={compact ? 5 : 7}
            pathOptions={{
              color: '#825835',
              fillColor: '#9A6B3F',
              fillOpacity: 0.85,
              weight: 1
            }}
            eventHandlers={{
              click: () => onSelect?.(item)
            }}
          >
            {!compact && (
              <Tooltip direction="top" offset={[0, -4]}>
                <span className="text-[11px] font-semibold">
                  {new Date(item.timestamp).toLocaleDateString(dateLocale, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                  {' · '}
                  {item.platform}
                </span>
              </Tooltip>
            )}
          </CircleMarker>
        ))}
      </MapContainer>
      {compact && (
        <p className="shrink-0 border-t border-ink-100 px-3 py-1.5 text-[10px] text-ink-400">
          {t('map.tilesHintShort')}
        </p>
      )}
    </div>
  );
};
