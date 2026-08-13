import { db } from '../db/db';

export type ArchivePlatform = 'facebook' | 'instagram';

export type ZipAccessState = 'ready' | 'needs-permission' | 'unavailable' | 'none';

export interface PlatformArchiveMeta {
  platform: ArchivePlatform;
  ownerName: string;
  zipFileName: string | null;
  messagesCount: number;
  mediaCount: number;
  postsCount: number;
}

/** Aggregated session stats — truthy when at least one platform is loaded */
export interface IngestionStats {
  messagesCount: number;
  mediaCount: number;
  postsCount: number;
  /** Primary platform for profile / greeting */
  platform: ArchivePlatform;
  ownerName: string;
  platforms: ArchivePlatform[];
  archives: Partial<Record<ArchivePlatform, PlatformArchiveMeta>>;
}

export const SESSION_STORAGE_KEY = 'meta_capsule_session';

export async function rebuildSessionStats(
  zipNames: Partial<Record<ArchivePlatform, string | null>> = {}
): Promise<IngestionStats | null> {
  const profiles = await db.profiles.toArray();
  if (profiles.length === 0) {
    const mediaCount = await db.media.count();
    if (mediaCount === 0) return null;
  }

  const platforms = new Set<ArchivePlatform>();
  for (const p of profiles) {
    platforms.add(p.platform);
  }
  // Also detect from data tables if profile missing
  for (const platform of ['facebook', 'instagram'] as ArchivePlatform[]) {
    const has =
      (await db.messages.where('platform').equals(platform).count()) > 0 ||
      (await db.media.where('platform').equals(platform).count()) > 0 ||
      (await db.posts.where('platform').equals(platform).count()) > 0;
    if (has) platforms.add(platform);
  }

  if (platforms.size === 0) return null;

  const archives: Partial<Record<ArchivePlatform, PlatformArchiveMeta>> = {};
  let messagesCount = 0;
  let mediaCount = 0;
  let postsCount = 0;

  for (const platform of platforms) {
    const profile = profiles.find((p) => p.platform === platform);
    const [mCount, medCount, pCount] = await Promise.all([
      db.messages.where('platform').equals(platform).count(),
      db.media.where('platform').equals(platform).count(),
      db.posts.where('platform').equals(platform).count()
    ]);
    messagesCount += mCount;
    mediaCount += medCount;
    postsCount += pCount;
    archives[platform] = {
      platform,
      ownerName: profile?.name || platform,
      zipFileName: zipNames[platform] ?? null,
      messagesCount: mCount,
      mediaCount: medCount,
      postsCount: pCount
    };
  }

  const platformList = Array.from(platforms);
  const primary =
    platformList.find((p) => archives[p]?.ownerName && archives[p]!.ownerName !== p) ||
    platformList[0];

  return {
    messagesCount,
    mediaCount,
    postsCount,
    platform: primary,
    ownerName: archives[primary]?.ownerName || 'Utilisateur',
    platforms: platformList,
    archives
  };
}

export function persistSession(stats: IngestionStats): void {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      archives: Object.fromEntries(
        Object.entries(stats.archives).map(([platform, meta]) => [
          platform,
          meta
            ? {
                ownerName: meta.ownerName,
                zipFileName: meta.zipFileName,
                messagesCount: meta.messagesCount,
                mediaCount: meta.mediaCount,
                postsCount: meta.postsCount
              }
            : null
        ])
      ),
      primaryPlatform: stats.platform
    })
  );
  // Clear legacy keys
  localStorage.removeItem('meta_capsule_stats');
  localStorage.removeItem('meta_capsule_zip_name');
}

export function clearPersistedSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem('meta_capsule_stats');
  localStorage.removeItem('meta_capsule_zip_name');
}
