import { useEffect, useMemo, useState } from 'react';
import type { MediaAttachment } from '../db/models';
import { db } from '../db/db';
import { useLanguage } from '../context/LanguageContext';
import { enqueueReverseGeocode } from '../utils/nominatim';
import { clusterVisitedPlaces, type VisitedPlace } from '../utils/places';

export function useVisitedPlaces(items: MediaAttachment[]): {
  places: VisitedPlace[];
  namingRemaining: number;
} {
  const { locale } = useLanguage();
  const clusters = useMemo(() => clusterVisitedPlaces(items), [items]);
  const clusterKey = useMemo(() => clusters.map((c) => c.id).join('|'), [clusters]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [namingRemaining, setNamingRemaining] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (clusters.length === 0) {
        setLabels({});
        setNamingRemaining(0);
        return;
      }

      const cached = await db.geocodeCache.bulkGet(clusters.map((c) => c.id));
      const initial: Record<string, string> = {};
      const misses: VisitedPlace[] = [];
      clusters.forEach((place, i) => {
        const hit = cached[i];
        if (hit?.label) initial[place.id] = hit.label;
        else misses.push(place);
      });

      if (cancelled) return;
      setLabels(initial);
      setNamingRemaining(misses.length);

      const language = locale === 'fr' ? 'fr' : 'en';
      for (const place of misses) {
        if (cancelled) return;
        const label = await enqueueReverseGeocode(
          place.id,
          place.latitude,
          place.longitude,
          language
        );
        if (cancelled) return;
        if (label) {
          setLabels((prev) => ({ ...prev, [place.id]: label }));
        }
        setNamingRemaining((n) => Math.max(0, n - 1));
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [clusterKey, clusters, locale]);

  const places = useMemo(
    () => clusters.map((c) => ({ ...c, label: labels[c.id] })),
    [clusters, labels]
  );

  return { places, namingRemaining };
}
