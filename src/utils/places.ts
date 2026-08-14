import type { MediaAttachment } from '../db/models';

/** ~330 m at the equator; groups the same street/park without collapsing a city. */
export const PLACE_GRID_DEGREES = 0.003;

export type VisitedPlace = {
  id: string;
  latitude: number;
  longitude: number;
  mediaCount: number;
  firstTimestamp: number;
  lastTimestamp: number;
  sampleMediaId: string;
  label?: string;
};

export function hasGpsCoords(
  item: MediaAttachment
): item is MediaAttachment & { latitude: number; longitude: number } {
  return (
    typeof item.latitude === 'number' &&
    typeof item.longitude === 'number' &&
    Number.isFinite(item.latitude) &&
    Number.isFinite(item.longitude) &&
    !(item.latitude === 0 && item.longitude === 0)
  );
}

export function placeCellId(lat: number, lng: number): string {
  const latCell = Math.round(lat / PLACE_GRID_DEGREES);
  const lngCell = Math.round(lng / PLACE_GRID_DEGREES);
  return `${latCell},${lngCell}`;
}

type Acc = {
  id: string;
  latSum: number;
  lngSum: number;
  mediaCount: number;
  firstTimestamp: number;
  lastTimestamp: number;
  sampleMediaId: string;
};

export function clusterVisitedPlaces(items: MediaAttachment[]): VisitedPlace[] {
  const buckets = new Map<string, Acc>();

  for (const item of items) {
    if (!hasGpsCoords(item)) continue;
    const id = placeCellId(item.latitude, item.longitude);
    const existing = buckets.get(id);
    if (!existing) {
      buckets.set(id, {
        id,
        latSum: item.latitude,
        lngSum: item.longitude,
        mediaCount: 1,
        firstTimestamp: item.timestamp,
        lastTimestamp: item.timestamp,
        sampleMediaId: item.id
      });
      continue;
    }
    existing.latSum += item.latitude;
    existing.lngSum += item.longitude;
    existing.mediaCount += 1;
    if (item.timestamp < existing.firstTimestamp) existing.firstTimestamp = item.timestamp;
    if (item.timestamp > existing.lastTimestamp) {
      existing.lastTimestamp = item.timestamp;
      existing.sampleMediaId = item.id;
    }
  }

  return Array.from(buckets.values())
    .map((acc) => ({
      id: acc.id,
      latitude: acc.latSum / acc.mediaCount,
      longitude: acc.lngSum / acc.mediaCount,
      mediaCount: acc.mediaCount,
      firstTimestamp: acc.firstTimestamp,
      lastTimestamp: acc.lastTimestamp,
      sampleMediaId: acc.sampleMediaId
    }))
    .sort((a, b) => {
      if (b.mediaCount !== a.mediaCount) return b.mediaCount - a.mediaCount;
      return b.lastTimestamp - a.lastTimestamp;
    });
}

export function fallbackPlaceLabel(lat: number, lng: number): string {
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}
