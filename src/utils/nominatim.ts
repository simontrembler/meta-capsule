import { db } from '../db/db';

/**
 * Nominatim usage policy: max 1 request/s, cache results, no bulk abuse.
 * https://operations.osmfoundation.org/policies/nominatim/
 * Browsers cannot set a custom User-Agent; identification is via Referer + Accept.
 */
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
const MIN_INTERVAL_MS = 1100;

type NominatimAddress = {
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  road?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
};

type NominatimReverse = {
  display_name?: string;
  address?: NominatimAddress;
};

type GeocodeJob = {
  cellId: string;
  latitude: number;
  longitude: number;
  language: string;
  resolve: (label: string | null) => void;
};

const queue: GeocodeJob[] = [];
const inflight = new Map<string, Promise<string | null>>();
let pumping = false;
let lastRequestAt = 0;

export function formatNominatimLabel(data: NominatimReverse): string {
  const a = data.address ?? {};
  const locality = a.neighbourhood || a.suburb || a.quarter || a.city_district;
  const city = a.city || a.town || a.village || a.municipality;
  const road = a.road;

  if (locality && city) return `${locality}, ${city}`;
  if (road && city) return `${road}, ${city}`;
  if (locality) return locality;
  if (city && a.country) return `${city}, ${a.country}`;
  if (city) return city;
  if (data.display_name) {
    return data.display_name.split(',').slice(0, 2).join(',').trim();
  }
  return '';
}

async function reverseGeocode(
  latitude: number,
  longitude: number,
  language: string
): Promise<string | null> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0 && lastRequestAt !== 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();

  const url = new URL(NOMINATIM_REVERSE);
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '16');
  url.searchParams.set('accept-language', language);

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) return null;
  const data = (await res.json()) as NominatimReverse;
  const label = formatNominatimLabel(data);
  return label || null;
}

async function pumpQueue() {
  if (pumping) return;
  pumping = true;
  while (queue.length > 0) {
    const job = queue.shift();
    if (!job) break;
    try {
      const cached = await db.geocodeCache.get(job.cellId);
      if (cached?.label) {
        job.resolve(cached.label);
        continue;
      }
      const label = await reverseGeocode(job.latitude, job.longitude, job.language);
      if (label) {
        await db.geocodeCache.put({
          id: job.cellId,
          label,
          fetchedAt: Date.now()
        });
      }
      job.resolve(label);
    } catch {
      job.resolve(null);
    }
  }
  pumping = false;
}

/** Sequential Nominatim reverse geocode with IndexedDB cache (1 req/s). */
export function enqueueReverseGeocode(
  cellId: string,
  latitude: number,
  longitude: number,
  language: string
): Promise<string | null> {
  const existing = inflight.get(cellId);
  if (existing) return existing;

  const promise = new Promise<string | null>((resolve) => {
    queue.push({ cellId, latitude, longitude, language, resolve });
    void pumpQueue();
  }).finally(() => {
    inflight.delete(cellId);
  });

  inflight.set(cellId, promise);
  return promise;
}
