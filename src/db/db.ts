import Dexie, { type Table } from 'dexie';
import type {
  UserProfile,
  Conversation,
  Message,
  Post,
  MediaAttachment,
  AdTargeting
} from './models';

export class MetaArchiveDatabase extends Dexie {
  profiles!: Table<UserProfile, string>;
  conversations!: Table<Conversation, string>;
  messages!: Table<Message, string>;
  posts!: Table<Post, string>;
  media!: Table<MediaAttachment, string>;
  adTargeting!: Table<AdTargeting, string>;

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
  }

  /**
   * Clears all tables in the database.
   * Useful for resetting the application or switching archives.
   */
  async clearAll() {
    await Promise.all([
      this.profiles.clear(),
      this.conversations.clear(),
      this.messages.clear(),
      this.posts.clear(),
      this.media.clear(),
      this.adTargeting.clear()
    ]);
  }
}

export const db = new MetaArchiveDatabase();
export default db;
