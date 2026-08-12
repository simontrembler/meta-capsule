import Dexie, { type Table } from 'dexie';
import type {
  UserProfile,
  Conversation,
  Message,
  Post,
  MediaAttachment,
  AdTargeting
} from './models';
import type { FileSystemFileHandle } from '../types/file-system-access';

export interface StoredFileHandle {
  id: string;
  fileName: string;
  handle: FileSystemFileHandle;
}

export class MetaArchiveDatabase extends Dexie {
  profiles!: Table<UserProfile, string>;
  conversations!: Table<Conversation, string>;
  messages!: Table<Message, string>;
  posts!: Table<Post, string>;
  media!: Table<MediaAttachment, string>;
  adTargeting!: Table<AdTargeting, string>;
  fileHandles!: Table<StoredFileHandle, string>;

  constructor() {
    super('MetaArchiveViewerDB');

    this.version(1).stores({
      profiles: 'id, platform',
      conversations: 'id, platform, lastMessageTimestamp, *participants',
      messages: 'id, conversationId, timestamp, [conversationId+timestamp], platform, isFromUser',
      posts: 'id, platform, type, timestamp, [platform+type]',
      media: 'id, platform, relativePath, type, timestamp',
      adTargeting: 'id, platform'
    });

    // Persist FileSystemFileHandle across refreshes (Chromium File System Access API)
    this.version(2).stores({
      fileHandles: 'id, fileName'
    });

    // Media origin (post / story / message) for gallery filters
    this.version(3).stores({
      media: 'id, platform, relativePath, type, source, timestamp, [source+timestamp]'
    });
  }

  /**
   * Clears imported data for one platform only (keeps the other archive).
   */
  async clearPlatformData(platform: 'facebook' | 'instagram') {
    await Promise.all([
      this.profiles.where('platform').equals(platform).delete(),
      this.conversations.where('platform').equals(platform).delete(),
      this.messages.where('platform').equals(platform).delete(),
      this.posts.where('platform').equals(platform).delete(),
      this.media.where('platform').equals(platform).delete(),
      this.adTargeting.where('platform').equals(platform).delete()
    ]);
  }

  /**
   * Clears imported archive data, but keeps persisted File System Access handles.
   */
  async clearArchiveData() {
    await Promise.all([
      this.profiles.clear(),
      this.conversations.clear(),
      this.messages.clear(),
      this.posts.clear(),
      this.media.clear(),
      this.adTargeting.clear()
    ]);
  }

  /**
   * Clears all tables including persisted file handles.
   */
  async clearAll() {
    await Promise.all([
      this.clearArchiveData(),
      this.fileHandles.clear()
    ]);
  }
}

export const db = new MetaArchiveDatabase();
export default db;
