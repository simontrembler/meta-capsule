import { ZipReader, BlobReader, TextWriter, configure } from '@zip.js/zip.js';
import { db } from '../db/db';
import { decodeMetaObj } from '../utils/metaDecoder';
import type { Message, Post, MediaAttachment } from '../db/models';

// Disable nested workers inside our ingestion worker for maximum compatibility
configure({ useWebWorkers: false });

self.onmessage = async (event: MessageEvent) => {
  const { type, file } = event.data;

  if (type !== 'START') return;

  try {
    // Clear existing database before importing new archive
    await db.clearAll();

    const zipReader = new ZipReader(new BlobReader(file));
    const entries = await zipReader.getEntries();
    const totalEntries = entries.length;

    postMessage({
      type: 'PROGRESS',
      payload: { progress: 0, statusText: 'Analyse de l\'archive...' }
    });

    // Heuristics to find owner name and platform
    let ownerName = '';
    let platform: 'facebook' | 'instagram' = 'facebook';

    // First pass: Find profile files to detect owner and platform
    const profileEntries = entries.filter(e => 
      !e.directory && 
      (e.filename.includes('profile_information.json') || 
       e.filename.includes('personal_information.json') ||
       e.filename.includes('profile.json'))
    );

    for (const entry of profileEntries) {
      const text = await (entry as any).getData(new TextWriter());
      const rawData = JSON.parse(text);
      const data = decodeMetaObj(rawData);

      if (entry.filename.includes('profile_information.json')) {
        // Facebook Profile
        platform = 'facebook';
        const profile = data.profile_v2 || data;
        ownerName = profile.name?.full_name || '';
        
        await db.profiles.put({
          id: 'facebook:profile',
          platform: 'facebook',
          name: ownerName,
          username: profile.username || ownerName.toLowerCase().replace(/\s+/g, ''),
          email: profile.emails?.emails?.[0],
          phoneNumber: profile.phone_numbers?.[0]?.phone_number,
          gender: profile.gender?.gender_option,
          dateOfBirth: profile.birthday ? `${profile.birthday.year}-${profile.birthday.month}-${profile.birthday.day}` : undefined
        });
      } else if (entry.filename.includes('personal_information.json') || entry.filename.includes('profile.json')) {
        // Instagram Profile
        platform = 'instagram';
        const profileUser = data.profile_user?.[0]?.string_map_data || data;
        ownerName = profileUser.Name?.value || '';
        
        await db.profiles.put({
          id: 'instagram:profile',
          platform: 'instagram',
          name: ownerName,
          username: profileUser.Username?.value || '',
          bio: profileUser.Biography?.value,
          email: profileUser.Email?.value,
          phoneNumber: profileUser['Phone Number']?.value,
          gender: profileUser.Gender?.value,
          dateOfBirth: profileUser['Date of birth']?.value
        });
      }
    }

    // If we didn't find any profile, try to guess the platform from paths
    if (!ownerName) {
      const hasIG = entries.some(e => e.filename.includes('instagram') || e.filename.includes('your_activity'));
      platform = hasIG ? 'instagram' : 'facebook';
    }

    let processedCount = 0;
    let messagesCount = 0;
    let mediaCount = 0;
    let postsCount = 0;

    // We will batch database writes to avoid blocking the DB
    const messageBatch: Message[] = [];
    const mediaBatch: MediaAttachment[] = [];
    const postBatch: Post[] = [];

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

    // Helper to determine media type from extension
    const getMediaType = (filename: string): 'photo' | 'video' | 'audio' | 'file' => {
      const ext = filename.split('.').pop()?.toLowerCase();
      if (!ext) return 'file';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return 'photo';
      if (['mp4', 'mov', 'avi', 'm4v', 'mkv', '3gp'].includes(ext)) return 'video';
      if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return 'audio';
      return 'file';
    };

    // Second pass: Process all entries
    for (const entry of entries) {
      processedCount++;

      if (entry.directory) continue;

      const filename = entry.filename;
      const lowerFilename = filename.toLowerCase();

      // 1. Index media files
      const isMediaFile = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'mp4', 'mov', 'avi', 'm4v', 'mp3', 'wav', 'ogg', 'm4a'].some(ext => lowerFilename.endsWith('.' + ext));
      if (isMediaFile) {
        const type = getMediaType(filename);
        const timestamp = entry.lastModDate ? entry.lastModDate.getTime() : Date.now();
        
        mediaBatch.push({
          id: `${platform}:${filename}`,
          platform,
          relativePath: filename,
          type,
          timestamp
        });

        if (mediaBatch.length >= BATCH_SIZE) {
          await flushBatches();
        }
      }

      // 2. Parse JSON files
      if (lowerFilename.endsWith('.json')) {
        try {
          // A. Messages
          if (lowerFilename.includes('messages/inbox/') && lowerFilename.includes('message_')) {
            const text = await (entry as any).getData(new TextWriter());
            const rawData = JSON.parse(text);
            const data = decodeMetaObj(rawData);

            // Extract conversation ID from folder name
            const pathParts = filename.split('/');
            const folderName = pathParts[pathParts.length - 2];
            const conversationId = `${platform}:${folderName}`;

            const title = data.title || folderName;
            const participants = (data.participants || []).map((p: any) => p.name);
            const messages = data.messages || [];

            if (messages.length > 0) {
              // Add or update conversation
              const lastMsg = messages[0];
              const lastMsgTimestamp = lastMsg.timestamp_ms || Date.now();
              const lastMsgText = lastMsg.content || (lastMsg.photos ? '[Photo]' : lastMsg.videos ? '[Vidéo]' : '[Message]');

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
                  lastMessageText: lastMsgTimestamp >= existingConv.lastMessageTimestamp ? lastMsgText : existingConv.lastMessageText
                });
              }

              // Add messages to batch
              for (const msg of messages) {
                const msgId = `${platform}:${conversationId}:${msg.timestamp_ms}:${msg.sender_name}`;
                
                // Map attachments
                const attachments: any[] = [];
                if (msg.photos) {
                  msg.photos.forEach((p: any) => attachments.push({ relativePath: p.uri, type: 'photo' }));
                }
                if (msg.videos) {
                  msg.videos.forEach((v: any) => attachments.push({ relativePath: v.uri, type: 'video' }));
                }
                if (msg.audio_files) {
                  msg.audio_files.forEach((a: any) => attachments.push({ relativePath: a.uri, type: 'audio' }));
                }
                if (msg.files) {
                  msg.files.forEach((f: any) => attachments.push({ relativePath: f.uri, type: 'file' }));
                }

                messageBatch.push({
                  id: msgId,
                  conversationId,
                  platform,
                  senderName: msg.sender_name,
                  isFromUser: msg.sender_name === ownerName,
                  content: msg.content || '',
                  timestamp: msg.timestamp_ms,
                  attachments: attachments.length > 0 ? attachments : undefined,
                  reactions: msg.reactions?.map((r: any) => ({ sender: r.actor, reaction: r.reaction }))
                });

                if (messageBatch.length >= BATCH_SIZE) {
                  await flushBatches();
                }
              }
            }
          }

          // B. Instagram Posts & Stories
          else if (platform === 'instagram' && lowerFilename.includes('posts/media.json')) {
            const text = await (entry as any).getData(new TextWriter());
            const rawData = JSON.parse(text);
            const data = decodeMetaObj(rawData);

            // Photos
            if (data.photos) {
              for (const item of data.photos) {
                postBatch.push({
                  id: `${platform}:post:${item.creation_timestamp}:${item.path}`,
                  platform,
                  type: 'post',
                  content: item.title || '',
                  timestamp: item.creation_timestamp * 1000,
                  media: [{ relativePath: item.path, type: 'photo' }]
                });
              }
            }

            // Videos
            if (data.videos) {
              for (const item of data.videos) {
                postBatch.push({
                  id: `${platform}:post:${item.creation_timestamp}:${item.path}`,
                  platform,
                  type: 'post',
                  content: item.title || '',
                  timestamp: item.creation_timestamp * 1000,
                  media: [{ relativePath: item.path, type: 'video' }]
                });
              }
            }

            // Stories
            if (data.stories) {
              for (const item of data.stories) {
                postBatch.push({
                  id: `${platform}:story:${item.creation_timestamp}:${item.path}`,
                  platform,
                  type: 'story',
                  content: '',
                  timestamp: item.creation_timestamp * 1000,
                  media: [{ relativePath: item.path, type: getMediaType(item.path) as 'photo' | 'video' }]
                });
              }
            }

            if (postBatch.length >= BATCH_SIZE) {
              await flushBatches();
            }
          }

          // C. Facebook Posts
          else if (platform === 'facebook' && lowerFilename.includes('posts/your_posts_1.json')) {
            const text = await (entry as any).getData(new TextWriter());
            const rawData = JSON.parse(text);
            const data = decodeMetaObj(rawData);

            if (Array.isArray(data)) {
              for (const post of data) {
                const timestamp = (post.timestamp || 0) * 1000;
                const content = post.data?.[0]?.post || post.title || '';
                
                const media: any[] = [];
                if (post.attachments) {
                  for (const attachment of post.attachments) {
                    if (attachment.data) {
                      for (const subItem of attachment.data) {
                        if (subItem.media) {
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

          // D. Ad Targeting (Interests and Advertisers)
          else if (lowerFilename.includes('ads_interests.json') || lowerFilename.includes('advertisers_who_uploaded_a_contact_list')) {
            const text = await (entry as any).getData(new TextWriter());
            const rawData = JSON.parse(text);
            const data = decodeMetaObj(rawData);

            const adId = `${platform}:ad_data`;
            const existingAd = await db.adTargeting.get(adId) || {
              id: adId,
              platform,
              interests: [],
              advertisers: []
            };

            if (lowerFilename.includes('ads_interests.json')) {
              // Extract interests
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
              // Extract advertisers
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
        } catch (err: any) {
          console.error(`Error parsing file ${filename}:`, err);
          // Non-fatal error, continue processing other files
        }
      }

      // Send progress update every 50 entries to avoid flooding the main thread
      if (processedCount % 50 === 0 || processedCount === totalEntries) {
        const progress = Math.round((processedCount / totalEntries) * 100);
        postMessage({
          type: 'PROGRESS',
          payload: {
            progress,
            statusText: `Traitement : ${processedCount} / ${totalEntries} fichiers...`
          }
        });
      }
    }

    // Flush any remaining items in batches
    await flushBatches();
    await zipReader.close();

    // Send completion message
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
        message: error.message || 'Une erreur inconnue est survenue lors de l\'ingestion.'
      }
    });
  }
};
