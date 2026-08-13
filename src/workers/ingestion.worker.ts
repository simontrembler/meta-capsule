import { db } from '../db/db';
import { decodeMetaObj } from '../utils/metaDecoder';
import {
  entriesFromDirectory,
  entriesFromFileList,
  entriesFromZip,
  type ArchiveEntry
} from '../utils/archiveEntries';
import type { Message, Post, MediaAttachment, MediaSource } from '../db/models';
import type { FileSystemDirectoryHandle } from '../types/file-system-access';

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function getMediaType(filename: string): 'photo' | 'video' | 'audio' | 'file' {
  const path = normalizePath(filename).toLowerCase();
  // Instagram voice notes are often stored as .mp4 under .../audio/
  if (path.includes('/audio/')) return 'audio';

  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return 'file';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return 'photo';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return 'audio';
  if (['mp4', 'mov', 'avi', 'm4v', 'mkv', '3gp'].includes(ext)) return 'video';
  return 'file';
}

const MESSAGE_THREAD_PATHS = [
  'messages/inbox/',
  'messages/message_requests/',
  'messages/archived_threads/',
  'messages/filtered_threads/',
  'messages/e2ee_cutover/'
] as const;

function isMessageThreadJson(path: string): boolean {
  const lower = path.toLowerCase();
  return MESSAGE_THREAD_PATHS.some((p) => lower.includes(p)) && lower.includes('message_');
}

/** Infer origin from Meta export folder layout (posts / stories / DMs). */
function inferMediaSource(filename: string): MediaSource {
  const path = normalizePath(filename).toLowerCase();

  if (
    path.includes('/messages/') ||
    MESSAGE_THREAD_PATHS.some((p) => path.includes(p)) ||
    (path.includes('/inbox/') &&
      (path.includes('/photos/') || path.includes('/videos/') || path.includes('/audio/')))
  ) {
    return 'message';
  }

  if (path.includes('/stories/') || path.includes('/media/stories')) {
    return 'story';
  }

  if (
    path.includes('/media/posts') ||
    path.includes('/posts/') ||
    path.includes('your_instagram_activity/posts') ||
    path.includes('your_uncategorized_photos') ||
    path.includes('your_videos')
  ) {
    return 'post';
  }

  return 'other';
}

/** GPS from Meta JSON media_metadata (not binary EXIF). */
function extractGpsFromMedia(mediaObj: unknown): { latitude: number; longitude: number } | null {
  if (!mediaObj || typeof mediaObj !== 'object') return null;
  const meta = (mediaObj as { media_metadata?: Record<string, unknown> }).media_metadata;
  if (!meta || typeof meta !== 'object') return null;

  const buckets = [
    meta.photo_metadata,
    meta.video_metadata,
    meta
  ];

  for (const bucket of buckets) {
    if (!bucket || typeof bucket !== 'object') continue;
    const exif = (bucket as { exif_data?: unknown }).exif_data;
    const list = Array.isArray(exif) ? exif : exif ? [exif] : [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const lat = (item as { latitude?: unknown; Latitude?: unknown }).latitude
        ?? (item as { Latitude?: unknown }).Latitude;
      const lng = (item as { longitude?: unknown; Longitude?: unknown }).longitude
        ?? (item as { Longitude?: unknown }).Longitude;
      if (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        !(lat === 0 && lng === 0)
      ) {
        return { latitude: lat, longitude: lng };
      }
    }
  }
  return null;
}

function labelValueMap(item: { label_values?: Array<{ label?: string; value?: string; title?: string }> }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const lv of item.label_values || []) {
    if (!lv?.label) continue;
    const v = lv.value || lv.title;
    if (typeof v === 'string' && v.trim()) out[lv.label] = v.trim();
  }
  return out;
}

/** Facebook ZIP with only media (no profile/messages/posts JSON) — multi-part export trap. */
function facebookZipLacksCoreJson(entries: ArchiveEntry[]): boolean {
  let jsonCount = 0;
  let hasCore = false;
  for (const entry of entries) {
    if (entry.directory) continue;
    const f = entry.filename.toLowerCase().replace(/\\/g, '/');
    if (!f.endsWith('.json')) continue;
    jsonCount += 1;
    if (
      f.includes('profile_information.json') ||
      (f.includes('messages/') && f.includes('message_')) ||
      f.includes('posts/your_posts') ||
      f.includes('ads_interests.json') ||
      f.includes('personal_information/profile')
    ) {
      hasCore = true;
      break;
    }
  }
  return jsonCount === 0 || !hasCore;
}

function isMediaFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'mp4', 'mov', 'avi', 'm4v', 'mp3', 'wav', 'ogg', 'm4a']
    .some((ext) => lower.endsWith('.' + ext));
}

/** Meta ZIP lastModDate is usually the export date — prefer JSON / folder dates. */
function timestampFromPath(filename: string): number | null {
  // e.g. media/stories/202411/file.jpg or media/posts/202608/...
  const match = normalizePath(filename).match(/\/(20\d{2})(0[1-9]|1[0-2])(?:\/|$)/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, 15);
}

function toEpochMs(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  // Heuristic: seconds vs milliseconds
  return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
}

/**
 * Detect FB vs IG from ZIP name + entry paths.
 * Filename prefixes from Meta (`facebook-…`, `instagram-…`) always win —
 * never override them with weak path heuristics (FB exports contain
 * `personal_information/` and `your_activity` substrings that look like IG).
 */
function detectPlatformQuick(
  fileName: string,
  entries: ArchiveEntry[]
): 'facebook' | 'instagram' {
  const lowerName = fileName.toLowerCase();

  // Meta download names: facebook-<user>-YYYY-… / instagram-<user>-YYYY-…
  if (lowerName.startsWith('instagram-') || /(^|[_\s/-])instagram([_\s/-]|$)/i.test(lowerName)) {
    return 'instagram';
  }
  if (lowerName.startsWith('facebook-') || /(^|[_\s/-])facebook([_\s/-]|$)/i.test(lowerName)) {
    return 'facebook';
  }

  let igScore = 0;
  let fbScore = 0;

  for (const entry of entries) {
    const f = entry.filename.toLowerCase().replace(/\\/g, '/');

    if (
      f.includes('your_instagram_activity') ||
      f.includes('instagram_profile_information') ||
      /(^|\/)personal_information\.json$/.test(f) ||
      f.includes('/media/stories/') ||
      f.includes('/media/posts/')
    ) {
      igScore += 1;
    }

    if (
      f.includes('your_facebook_activity') ||
      (f.includes('/profile_information/profile_information.json') && !f.includes('instagram')) ||
      f.includes('/posts/your_posts') ||
      f.includes('messages/inbox/') && f.includes('your_facebook')
    ) {
      fbScore += 1;
    }
  }

  if (igScore > fbScore) return 'instagram';
  if (fbScore > igScore) return 'facebook';
  return 'facebook';
}

self.onmessage = async (event: MessageEvent) => {
  const { type, source, file, directoryHandle, files, archiveName } = event.data as {
    type: string;
    source?: 'zip' | 'directory' | 'files';
    file?: File;
    directoryHandle?: FileSystemDirectoryHandle;
    files?: File[];
    archiveName?: string;
  };

  if (type !== 'START') return;

  try {
    let entries: ArchiveEntry[];
    const displayName = archiveName || file?.name || directoryHandle?.name || 'archive';

    if (source === 'directory' && directoryHandle) {
      entries = await entriesFromDirectory(directoryHandle);
    } else if (source === 'files' && files && files.length > 0) {
      entries = entriesFromFileList(files);
    } else if (file) {
      entries = await entriesFromZip(file);
    } else {
      throw new Error("Aucune archive à lire (ZIP ou dossier).");
    }

    const totalEntries = entries.length;

    const detectedPlatform = detectPlatformQuick(displayName, entries);

    // Facebook multi-ZIP trap: a media-only part has no profile/messages/posts JSON.
    // Abort before clearPlatformData so we don't wipe a previous good FB index.
    if (
      detectedPlatform === 'facebook' &&
      source === 'zip' &&
      facebookZipLacksCoreJson(entries)
    ) {
      throw new Error(
        "Ce ZIP Facebook ne contient presque pas de métadonnées JSON (souvent une partie médias d’un export multi-fichiers). Importez le dossier dézippé fusionné, ou toutes les parties du même batch, pour ouvrir la capsule complète."
      );
    }

    postMessage({
      type: 'PROGRESS',
      payload: {
        progress: 0,
        statusText: `Préparation de l'archive ${detectedPlatform}…`
      }
    });

    // Replace only this platform — keep the other archive intact
    await db.clearPlatformData(detectedPlatform);

    postMessage({
      type: 'PROGRESS',
      payload: { progress: 0, statusText: "Analyse de l'archive..." }
    });

    let ownerName = '';
    let platform: 'facebook' | 'instagram' = detectedPlatform;

    // path → true creation timestamp (ms)
    const mediaTimestamps = new Map<string, number>();
    const mediaGps = new Map<string, { latitude: number; longitude: number }>();

    const mediaPathKeys = (uri: string): string[] => {
      const normalized = normalizePath(uri);
      return [
        normalized,
        normalized.replace(/\.[^.]+$/, ''),
        normalized.split('/').pop() || ''
      ].filter(Boolean);
    };

    const rememberMediaTimestamp = (uri: string | undefined, ts: number | null | undefined) => {
      if (!uri || !ts || !Number.isFinite(ts) || ts <= 0) return;
      for (const key of mediaPathKeys(uri)) {
        const existing = mediaTimestamps.get(key);
        // Prefer the oldest known timestamp when duplicates collide
        if (existing === undefined || ts < existing) {
          mediaTimestamps.set(key, ts);
        }
      }
    };

    const rememberMediaGps = (uri: string | undefined, mediaObj: unknown) => {
      if (!uri) return;
      const gps = extractGpsFromMedia(mediaObj);
      if (!gps) return;
      for (const key of mediaPathKeys(uri)) {
        if (!mediaGps.has(key)) mediaGps.set(key, gps);
      }
    };

    const resolveMediaTimestamp = (filename: string, lastModDate?: Date): number => {
      const normalized = normalizePath(filename);
      const candidates = [
        mediaTimestamps.get(normalized),
        mediaTimestamps.get(normalized.replace(/\.[^.]+$/, '')),
        mediaTimestamps.get(normalized.split('/').pop() || '')
      ].filter((v): v is number => typeof v === 'number');

      if (candidates.length > 0) return Math.min(...candidates);

      const fromPath = timestampFromPath(filename);
      if (fromPath) return fromPath;

      return lastModDate?.getTime() ?? Date.now();
    };

    const resolveMediaGps = (filename: string) => {
      const normalized = normalizePath(filename);
      return (
        mediaGps.get(normalized) ||
        mediaGps.get(normalized.replace(/\.[^.]+$/, '')) ||
        mediaGps.get(normalized.split('/').pop() || '') ||
        undefined
      );
    };

    // --- Profile / platform detection ---
    const profileEntries = entries.filter(
      (e) =>
        !e.directory &&
        (e.filename.includes('profile_information.json') ||
          e.filename.endsWith('/personal_information.json') ||
          e.filename.endsWith('personal_information.json') ||
          e.filename.includes('instagram_profile_information.json') ||
          e.filename.endsWith('profile.json'))
    );

    // Prefer the rich personal_information.json (has Username/Name) over
    // instagram_profile_information.json (login metadata only in newer exports).
    profileEntries.sort((a, b) => {
      const score = (name: string) => {
        if (name.endsWith('/personal_information.json') || name.endsWith('personal_information.json')) {
          // Exact file, not the parent folder coincidence
          if (name.split('/').pop() === 'personal_information.json') return 0;
        }
        if (name.includes('profile_user') || name.endsWith('profile.json')) return 1;
        if (name.includes('profile_information.json') && !name.includes('instagram')) return 2;
        return 5;
      };
      return score(a.filename) - score(b.filename);
    });

    let profileDraft: {
      name: string;
      username: string;
      bio?: string;
      email?: string;
      phoneNumber?: string;
      gender?: string;
      dateOfBirth?: string;
      profilePicture?: string;
    } = {
      name: '',
      username: ''
    };

    const mergeProfileField = <K extends keyof typeof profileDraft>(
      key: K,
      value: (typeof profileDraft)[K] | undefined | null
    ) => {
      if (value === undefined || value === null) return;
      if (typeof value === 'string' && value.trim() === '') return;
      if (!profileDraft[key]) {
        profileDraft[key] = value;
      }
    };

    for (const entry of profileEntries) {
      // Skip metadata-only IG file — it overwrote Username with empty in newer exports
      if (
        entry.filename.includes('instagram_profile_information.json') &&
        !entry.filename.endsWith('/personal_information.json')
      ) {
        continue;
      }

      const text = await entry.getText();
      const rawData = JSON.parse(text);
      const data = decodeMetaObj(rawData);

      const baseName = entry.filename.split('/').pop() || '';
      const isFacebookProfile =
        entry.filename.includes('profile_information.json') &&
        !entry.filename.includes('instagram') &&
        platform === 'facebook';
      const isInstagramProfile =
        platform === 'instagram' &&
        (baseName === 'personal_information.json' ||
          baseName === 'profile.json' ||
          Boolean(data.profile_user) ||
          Array.isArray(data.label_values));

      if (isFacebookProfile) {
        const profile = data.profile_v2 || data;
        ownerName = profile.name?.full_name || ownerName;

        await db.profiles.put({
          id: 'facebook:profile',
          platform: 'facebook',
          name: ownerName,
          username: profile.username || ownerName.toLowerCase().replace(/\s+/g, ''),
          email: profile.emails?.emails?.[0],
          phoneNumber: profile.phone_numbers?.[0]?.phone_number,
          gender: profile.gender?.gender_option,
          dateOfBirth: profile.birthday
            ? `${profile.birthday.year}-${profile.birthday.month}-${profile.birthday.day}`
            : undefined
        });
      } else if (isInstagramProfile) {
        const profileUser =
          data.profile_user?.[0]?.string_map_data ||
          data.profile_user?.[0] ||
          data;

        mergeProfileField('name', profileUser.Name?.value || '');
        mergeProfileField('username', profileUser.Username?.value || '');
        mergeProfileField('bio', profileUser.Bio?.value || profileUser.Biography?.value);
        mergeProfileField('email', profileUser.Email?.value);
        mergeProfileField('phoneNumber', profileUser['Phone Number']?.value);
        mergeProfileField('gender', profileUser.Gender?.value);
        mergeProfileField('dateOfBirth', profileUser['Date of birth']?.value);

        const photoUri = data.profile_user?.[0]?.media_map_data?.['Profile Photo']?.uri;
        mergeProfileField('profilePicture', photoUri);

        if (Array.isArray(data.label_values)) {
          const byLabel = (label: string) =>
            data.label_values.find((lv: any) => lv.label === label)?.value as string | undefined;
          mergeProfileField('name', byLabel('Name'));
          mergeProfileField('username', byLabel('Username'));
          mergeProfileField('bio', byLabel('Bio'));
          mergeProfileField('email', byLabel('Email'));
          mergeProfileField('phoneNumber', byLabel('Phone Number') || byLabel('Phone number'));
          mergeProfileField('gender', byLabel('Gender'));
          mergeProfileField('dateOfBirth', byLabel('Date of birth'));
        }

        ownerName = profileDraft.name || ownerName;
      }
    }

    // Fill IG username from ZIP name when needed — do not flip platform
    if (platform === 'instagram' && !profileDraft.username) {
      const fromZip = String(displayName || '').match(/^instagram-([^/\\]+?)-\d{4}/i);
      if (fromZip?.[1]) {
        profileDraft.username = fromZip[1];
      }
    }

    if (platform === 'instagram') {
      ownerName = profileDraft.name || ownerName || profileDraft.username || 'Instagram';
      await db.profiles.put({
        id: 'instagram:profile',
        platform: 'instagram',
        name: ownerName,
        username: profileDraft.username || '',
        bio: profileDraft.bio,
        email: profileDraft.email,
        phoneNumber: profileDraft.phoneNumber,
        gender: profileDraft.gender,
        dateOfBirth: profileDraft.dateOfBirth,
        profilePicture: profileDraft.profilePicture
      });
    }

    if (!ownerName) {
      ownerName = platform === 'instagram' ? 'Instagram' : 'Facebook';
    }

    let processedCount = 0;
    let messagesCount = 0;
    let mediaCount = 0;
    let postsCount = 0;

    const messageBatch: Message[] = [];
    const mediaBatch: MediaAttachment[] = [];
    const postBatch: Post[] = [];
    const pendingMediaFiles: Array<{ filename: string; lastModDate?: Date }> = [];

    const BATCH_SIZE = 500;

    const flushBatches = async () => {
      if (messageBatch.length > 0) {
        await db.messages.bulkPut(messageBatch);
        messagesCount += messageBatch.length;
        messageBatch.length = 0;
      }
      if (mediaBatch.length > 0) {
        await db.media.bulkPut(mediaBatch);
        mediaCount += mediaBatch.length;
        mediaBatch.length = 0;
      }
      if (postBatch.length > 0) {
        await db.posts.bulkPut(postBatch);
        postsCount += postBatch.length;
        postBatch.length = 0;
      }
    };

    const ingestFacebookPostLikeItems = (data: unknown, idPrefix: string) => {
      const items = Array.isArray(data)
        ? data
        : Array.isArray((data as { media?: unknown[] })?.media)
          ? (data as { media: unknown[] }).media
          : [];

      for (const raw of items) {
        const post = raw as {
          timestamp?: number;
          creation_timestamp?: number;
          title?: string;
          data?: Array<{ post?: string }>;
          uri?: string;
          attachments?: Array<{
            data?: Array<{ media?: { uri?: string; creation_timestamp?: number } }>;
          }>;
        };
        const timestamp =
          toEpochMs(post.timestamp) ||
          toEpochMs(post.creation_timestamp) ||
          0;
        const content = post.data?.[0]?.post || post.title || '';
        const media: Post['media'] = [];

        if (post.attachments) {
          for (const attachment of post.attachments) {
            if (!attachment.data) continue;
            for (const subItem of attachment.data) {
              const mediaObj = subItem.media;
              const uri = mediaObj?.uri;
              if (!uri) continue;
              rememberMediaTimestamp(
                uri,
                timestamp || toEpochMs(mediaObj?.creation_timestamp)
              );
              rememberMediaGps(uri, mediaObj);
              media.push({
                relativePath: uri,
                type: getMediaType(uri) as 'photo' | 'video'
              });
            }
          }
        } else if (post.uri) {
          rememberMediaTimestamp(post.uri, timestamp);
          rememberMediaGps(post.uri, post);
          media.push({
            relativePath: post.uri,
            type: getMediaType(post.uri) as 'photo' | 'video'
          });
        }

        if (!content && media.length === 0) continue;

        postBatch.push({
          id: `${platform}:${idPrefix}:${timestamp}:${content.substring(0, 30)}:${media[0]?.relativePath || ''}`,
          platform,
          type: 'post',
          content,
          timestamp,
          media
        });
      }
    };

    const extractIgMediaNodes = (item: any): any[] => {
      const nodes: any[] = [];
      if (!item || typeof item !== 'object') return nodes;

      if (typeof item.uri === 'string' && item.creation_timestamp) {
        nodes.push(item);
      }
      if (Array.isArray(item.media)) {
        nodes.push(...item.media);
      }
      if (Array.isArray(item.label_values)) {
        for (const lv of item.label_values) {
          if (Array.isArray(lv.media)) nodes.push(...lv.media);
        }
      }
      return nodes;
    };

    const ingestIgMediaDocument = (data: any, defaultType: 'post' | 'story') => {
      const items: any[] = [];

      if (Array.isArray(data)) {
        items.push(...data);
      } else if (Array.isArray(data?.ig_stories)) {
        items.push(...data.ig_stories);
      } else if (Array.isArray(data?.ig_reels)) {
        items.push(...data.ig_reels);
      } else {
        if (Array.isArray(data?.photos)) items.push(...data.photos.map((p: any) => ({ ...p, path: p.path || p.uri })));
        if (Array.isArray(data?.videos)) items.push(...data.videos.map((p: any) => ({ ...p, path: p.path || p.uri })));
        if (Array.isArray(data?.stories)) items.push(...data.stories.map((p: any) => ({ ...p, path: p.path || p.uri })));
      }

      for (const item of items) {
        const fallbackTs =
          toEpochMs(item.timestamp) ||
          toEpochMs(item.creation_timestamp) ||
          null;

        const mediaNodes = extractIgMediaNodes(item);
        const media: Post['media'] = [];

        if (mediaNodes.length === 0 && (item.path || item.uri)) {
          const uri = item.path || item.uri;
          const ts = toEpochMs(item.creation_timestamp) || fallbackTs;
          rememberMediaTimestamp(uri, ts);
          rememberMediaGps(uri, item);
          media.push({
            relativePath: uri,
            type: getMediaType(uri) as 'photo' | 'video'
          });
        } else {
          for (const node of mediaNodes) {
            const uri = node.uri || node.path;
            const ts = toEpochMs(node.creation_timestamp) || fallbackTs;
            rememberMediaTimestamp(uri, ts);
            rememberMediaGps(uri, node);
            if (uri) {
              media.push({
                relativePath: uri,
                type: getMediaType(uri) as 'photo' | 'video'
              });
            }
          }
        }

        const postTs =
          fallbackTs ||
          (mediaNodes[0] ? toEpochMs(mediaNodes[0].creation_timestamp) : null) ||
          Date.now();

        const content =
          item.title ||
          item.caption ||
          item.label_values?.find((lv: any) => lv.label === 'Caption')?.value ||
          '';

        postBatch.push({
          id: `${platform}:${defaultType}:${postTs}:${(media[0]?.relativePath || content).toString().slice(0, 40)}`,
          platform,
          type: defaultType,
          content,
          timestamp: postTs,
          media
        });
      }
    };

    // --- Pass 1: JSON metadata (+ collect media file names) ---
    for (const entry of entries) {
      processedCount++;
      if (entry.directory) continue;

      const filename = entry.filename;
      const lowerFilename = filename.toLowerCase();

      if (isMediaFilename(filename)) {
        pendingMediaFiles.push({
          filename,
          lastModDate: entry.lastModDate
        });
      }

      if (!lowerFilename.endsWith('.json')) {
        if (processedCount % 50 === 0 || processedCount === totalEntries) {
          postMessage({
            type: 'PROGRESS',
            payload: {
              progress: Math.round((processedCount / totalEntries) * 50),
              statusText: `Lecture métadonnées : ${processedCount} / ${totalEntries}...`
            }
          });
        }
        continue;
      }

      try {
        // A. Messages (inbox, requests, archived, filtered, e2ee cutover)
        if (isMessageThreadJson(lowerFilename)) {
          const text = await entry.getText();
          const rawData = JSON.parse(text);
          const data = decodeMetaObj(rawData);

          const pathParts = filename.split('/');
          const folderName = pathParts[pathParts.length - 2];
          const conversationId = `${platform}:${folderName}`;

          const title = data.title || folderName;
          const participants = (data.participants || []).map((p: any) => p.name);
          const messages = data.messages || [];

          if (messages.length > 0) {
            const lastMsg = messages[0];
            const lastMsgTimestamp = lastMsg.timestamp_ms || Date.now();
            const lastMsgText =
              lastMsg.content ||
              (lastMsg.photos ? '[Photo]' : lastMsg.videos ? '[Vidéo]' : '[Message]');

            const existingConv = await db.conversations.get(conversationId);
            if (!existingConv) {
              await db.conversations.put({
                id: conversationId,
                platform,
                title,
                isGroup: data.thread_type === 'RegularGroup' || participants.length > 2,
                participants,
                lastMessageText: lastMsgText,
                lastMessageTimestamp: lastMsgTimestamp,
                messageCount: messages.length
              });
            } else {
              await db.conversations.update(conversationId, {
                messageCount: existingConv.messageCount + messages.length,
                lastMessageTimestamp: Math.max(existingConv.lastMessageTimestamp, lastMsgTimestamp),
                lastMessageText:
                  lastMsgTimestamp >= existingConv.lastMessageTimestamp
                    ? lastMsgText
                    : existingConv.lastMessageText
              });
            }

            for (const msg of messages) {
              const msgId = `${platform}:${conversationId}:${msg.timestamp_ms}:${msg.sender_name}`;
              const attachments: any[] = [];
              const msgTs = toEpochMs(msg.timestamp_ms) || Date.now();

              const pushAttachments = (list: any[] | undefined, kind: 'photo' | 'video' | 'audio' | 'file') => {
                if (!list) return;
                for (const item of list) {
                  const uri = item.uri || item.path;
                  rememberMediaTimestamp(uri, msgTs);
                  if (uri) attachments.push({ relativePath: uri, type: kind });
                }
              };

              pushAttachments(msg.photos, 'photo');
              pushAttachments(msg.videos, 'video');
              pushAttachments(msg.audio_files, 'audio');
              pushAttachments(msg.files, 'file');

              messageBatch.push({
                id: msgId,
                conversationId,
                platform,
                senderName: msg.sender_name,
                isFromUser: msg.sender_name === ownerName,
                content: msg.content || '',
                timestamp: msgTs,
                attachments: attachments.length > 0 ? attachments : undefined,
                reactions: msg.reactions?.map((r: any) => ({ sender: r.actor, reaction: r.reaction }))
              });

              if (messageBatch.length >= BATCH_SIZE) {
                await flushBatches();
              }
            }
          }
        }

        // B. Instagram posts / stories / other content (current + legacy layouts)
        else if (
          platform === 'instagram' &&
          (lowerFilename.includes('/media/posts') ||
            lowerFilename.includes('/media/stories') ||
            lowerFilename.includes('/media/other_content') ||
            lowerFilename.includes('/media/profile_photos') ||
            lowerFilename.includes('posts/media.json') ||
            lowerFilename.endsWith('/media.json'))
        ) {
          const text = await entry.getText();
          const rawData = JSON.parse(text);
          const data = decodeMetaObj(rawData);
          const defaultType: 'post' | 'story' = lowerFilename.includes('stor') ? 'story' : 'post';
          ingestIgMediaDocument(data, defaultType);

          if (postBatch.length >= BATCH_SIZE) {
            await flushBatches();
          }
        }

        // B2. Instagram saved posts (bookmarks — capsule memory)
        else if (
          platform === 'instagram' &&
          (lowerFilename.includes('/saved/saved_posts.json') ||
            lowerFilename.endsWith('saved_posts.json'))
        ) {
          const text = await entry.getText();
          const rawData = JSON.parse(text);
          const data = decodeMetaObj(rawData);
          const items = Array.isArray(data)
            ? data
            : Array.isArray(data?.saved_saved_media)
              ? data.saved_saved_media
              : Array.isArray(data?.saved_media)
                ? data.saved_media
                : [];

          for (const item of items) {
            const labels = labelValueMap(item);
            const content =
              labels.Caption ||
              labels.Title ||
              labels.Name ||
              Object.values(labels).find((v) => v.length > 2) ||
              '';
            const ts =
              toEpochMs(item.timestamp) ||
              toEpochMs(item.timestamp_ms) ||
              toEpochMs(labels.Time ? Date.parse(labels.Time) / 1000 : null) ||
              0;
            if (!content && !ts) continue;
            postBatch.push({
              id: `${platform}:saved:${ts}:${content.substring(0, 40)}`,
              platform,
              type: 'post',
              content: content ? `Saved · ${content}` : 'Saved post',
              timestamp: ts || Date.now(),
              media: []
            });
            if (postBatch.length >= BATCH_SIZE) {
              await flushBatches();
            }
          }
        }

        // C. Facebook posts + albums + uncategorized photos/videos
        else if (
          platform === 'facebook' &&
          (lowerFilename.includes('posts/your_posts') ||
            lowerFilename.includes('/posts/album/') ||
            lowerFilename.includes('your_uncategorized_photos') ||
            lowerFilename.includes('your_videos.json') ||
            /\/posts\/album\/[^/]+\.json$/.test(lowerFilename))
        ) {
          const text = await entry.getText();
          const rawData = JSON.parse(text);
          const data = decodeMetaObj(rawData);
          const idPrefix = lowerFilename.includes('/album/')
            ? 'album'
            : lowerFilename.includes('uncategorized')
              ? 'uncategorized'
              : lowerFilename.includes('your_videos')
                ? 'video'
                : 'post';
          ingestFacebookPostLikeItems(data, idPrefix);

          if (postBatch.length >= BATCH_SIZE) {
            await flushBatches();
          }
        }

        // D. Ad Targeting
        else if (
          lowerFilename.includes('ads_interests.json') ||
          lowerFilename.includes('advertisers_who_uploaded_a_contact_list') ||
          lowerFilename.includes('advertisers_using_your_activity_or_information')
        ) {
          const text = await entry.getText();
          const rawData = JSON.parse(text);
          const data = decodeMetaObj(rawData);

          const adId = `${platform}:ad_data`;
          const existingAd = (await db.adTargeting.get(adId)) || {
            id: adId,
            platform,
            interests: [] as string[],
            advertisers: [] as string[]
          };

          if (lowerFilename.includes('ads_interests.json')) {
            const interests: string[] = [];
            const topics = data.topics_v2 || data.inferred_topics || [];
            for (const topic of topics) {
              if (topic.string_map_data?.Interest?.value) {
                interests.push(topic.string_map_data.Interest.value);
              } else if (typeof topic === 'string') {
                interests.push(topic);
              } else if (topic.value) {
                interests.push(topic.value);
              }
            }
            existingAd.interests = Array.from(new Set([...existingAd.interests, ...interests]));
          } else {
            const advertisers: string[] = [];
            const customAudiences = data.custom_audiences_v2 || data.custom_audiences || [];
            for (const aud of customAudiences) {
              if (aud.advertiser_name) {
                advertisers.push(aud.advertiser_name);
              } else if (typeof aud === 'string') {
                advertisers.push(aud);
              }
            }

            // Newer FB export: advertisers_using_your_activity_or_information.json
            const labelItems = Array.isArray(data)
              ? data
              : Array.isArray(data?.label_values)
                ? [data]
                : Array.isArray(data?.custom_audiences_info_v2)
                  ? data.custom_audiences_info_v2
                  : Array.isArray(data?.vec)
                    ? data.vec
                    : [];

            for (const item of labelItems) {
              if (typeof item === 'string') {
                advertisers.push(item);
                continue;
              }
              const labels = labelValueMap(item);
              const name =
                labels['Advertiser Name'] ||
                labels.Advertiser ||
                labels.Name ||
                labels.Title ||
                item.advertiser_name ||
                item.title ||
                item.name;
              if (typeof name === 'string' && name.trim()) {
                advertisers.push(name.trim());
              }
            }

            existingAd.advertisers = Array.from(new Set([...existingAd.advertisers, ...advertisers]));
          }

          await db.adTargeting.put(existingAd);
        }
      } catch (err) {
        console.error(`Error parsing file ${filename}:`, err);
      }

      if (processedCount % 50 === 0 || processedCount === totalEntries) {
        postMessage({
          type: 'PROGRESS',
          payload: {
            progress: Math.round((processedCount / totalEntries) * 50),
            statusText: `Lecture métadonnées : ${processedCount} / ${totalEntries}...`
          }
        });
      }
    }

    // --- Pass 2: index media files with real timestamps ---
    postMessage({
      type: 'PROGRESS',
      payload: {
        progress: 55,
        statusText: `Indexation médias (${pendingMediaFiles.length}) avec dates réelles...`
      }
    });

    for (let i = 0; i < pendingMediaFiles.length; i++) {
      const { filename, lastModDate } = pendingMediaFiles[i];
      const gps = resolveMediaGps(filename);
      mediaBatch.push({
        id: `${platform}:${filename}`,
        platform,
        relativePath: filename,
        type: getMediaType(filename),
        source: inferMediaSource(filename),
        timestamp: resolveMediaTimestamp(filename, lastModDate),
        ...(gps ? { latitude: gps.latitude, longitude: gps.longitude } : {})
      });

      if (mediaBatch.length >= BATCH_SIZE) {
        await flushBatches();
      }

      if (i % 200 === 0 || i === pendingMediaFiles.length - 1) {
        const progress = 55 + Math.round(((i + 1) / Math.max(pendingMediaFiles.length, 1)) * 45);
        postMessage({
          type: 'PROGRESS',
          payload: {
            progress,
            statusText: `Indexation médias : ${i + 1} / ${pendingMediaFiles.length}...`
          }
        });
      }
    }

    await flushBatches();

    postMessage({
      type: 'COMPLETE',
      payload: {
        stats: {
          messagesCount,
          mediaCount,
          postsCount,
          platform,
          ownerName
        }
      }
    });
  } catch (error: any) {
    postMessage({
      type: 'ERROR',
      payload: {
        message: error.message || "Une erreur inconnue est survenue lors de l'ingestion."
      }
    });
  }
};
