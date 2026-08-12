import type { Entry } from '@zip.js/zip.js';
import { ZipReader, BlobReader, TextWriter, configure } from '@zip.js/zip.js';
import { db } from '../db/db';
import { decodeMetaObj } from '../utils/metaDecoder';
import type { Message, Post, MediaAttachment, MediaSource } from '../db/models';

// Disable nested workers inside our ingestion worker for maximum compatibility
configure({ useWebWorkers: false });

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

/** Infer origin from Meta export folder layout (posts / stories / DMs). */
function inferMediaSource(filename: string): MediaSource {
  const path = normalizePath(filename).toLowerCase();

  if (
    path.includes('/messages/') ||
    path.includes('messages/inbox') ||
    path.includes('messages/message_requests') ||
    path.includes('/inbox/') && (path.includes('/photos/') || path.includes('/videos/') || path.includes('/audio/'))
  ) {
    return 'message';
  }

  if (path.includes('/stories/') || path.includes('/media/stories')) {
    return 'story';
  }

  if (
    path.includes('/media/posts') ||
    path.includes('/posts/') ||
    path.includes('your_instagram_activity/posts')
  ) {
    return 'post';
  }

  return 'other';
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
  entries: Entry[]
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
  const { type, file } = event.data;

  if (type !== 'START') return;

  try {
    const zipReader = new ZipReader(new BlobReader(file));
    const entries = await zipReader.getEntries();
    const totalEntries = entries.length;

    const detectedPlatform = detectPlatformQuick(file.name || '', entries);

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

    const rememberMediaTimestamp = (uri: string | undefined, ts: number | null | undefined) => {
      if (!uri || !ts || !Number.isFinite(ts) || ts <= 0) return;
      const normalized = normalizePath(uri);
      const keys = [
        normalized,
        normalized.replace(/\.[^.]+$/, ''),
        normalized.split('/').pop() || ''
      ].filter(Boolean);

      for (const key of keys) {
        const existing = mediaTimestamps.get(key);
        // Prefer the oldest known timestamp when duplicates collide
        if (existing === undefined || ts < existing) {
          mediaTimestamps.set(key, ts);
        }
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

      const text = await (entry as Entry & { getData: Function }).getData(new TextWriter());
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
      const fromZip = String(file?.name || '').match(/^instagram-([^/\\]+?)-\d{4}/i);
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
          media.push({
            relativePath: uri,
            type: getMediaType(uri) as 'photo' | 'video'
          });
        } else {
          for (const node of mediaNodes) {
            const uri = node.uri || node.path;
            const ts = toEpochMs(node.creation_timestamp) || fallbackTs;
            rememberMediaTimestamp(uri, ts);
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
        // A. Messages (inbox + message requests)
        if (
          (lowerFilename.includes('messages/inbox/') || lowerFilename.includes('messages/message_requests/')) &&
          lowerFilename.includes('message_')
        ) {
          const text = await (entry as Entry & { getData: Function }).getData(new TextWriter());
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
          const text = await (entry as Entry & { getData: Function }).getData(new TextWriter());
          const rawData = JSON.parse(text);
          const data = decodeMetaObj(rawData);
          const defaultType: 'post' | 'story' = lowerFilename.includes('stor') ? 'story' : 'post';
          ingestIgMediaDocument(data, defaultType);

          if (postBatch.length >= BATCH_SIZE) {
            await flushBatches();
          }
        }

        // C. Facebook Posts
        else if (platform === 'facebook' && lowerFilename.includes('posts/your_posts')) {
          const text = await (entry as Entry & { getData: Function }).getData(new TextWriter());
          const rawData = JSON.parse(text);
          const data = decodeMetaObj(rawData);

          if (Array.isArray(data)) {
            for (const post of data) {
              const timestamp = toEpochMs(post.timestamp) || 0;
              const content = post.data?.[0]?.post || post.title || '';
              const media: Post['media'] = [];

              if (post.attachments) {
                for (const attachment of post.attachments) {
                  if (attachment.data) {
                    for (const subItem of attachment.data) {
                      if (subItem.media?.uri) {
                        rememberMediaTimestamp(subItem.media.uri, timestamp);
                        media.push({
                          relativePath: subItem.media.uri,
                          type: getMediaType(subItem.media.uri) as 'photo' | 'video'
                        });
                      }
                    }
                  }
                }
              }

              postBatch.push({
                id: `${platform}:post:${post.timestamp}:${content.substring(0, 30)}`,
                platform,
                type: 'post',
                content,
                timestamp,
                media
              });

              if (postBatch.length >= BATCH_SIZE) {
                await flushBatches();
              }
            }
          }
        }

        // D. Ad Targeting
        else if (
          lowerFilename.includes('ads_interests.json') ||
          lowerFilename.includes('advertisers_who_uploaded_a_contact_list')
        ) {
          const text = await (entry as Entry & { getData: Function }).getData(new TextWriter());
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
      mediaBatch.push({
        id: `${platform}:${filename}`,
        platform,
        relativePath: filename,
        type: getMediaType(filename),
        source: inferMediaSource(filename),
        timestamp: resolveMediaTimestamp(filename, lastModDate)
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
    await zipReader.close();

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
