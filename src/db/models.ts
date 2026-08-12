export interface UserProfile {
  id: string; // e.g. "facebook:username"
  platform: 'facebook' | 'instagram';
  name: string;
  username: string;
  profilePicture?: string; // Blob URL or base64
  bio?: string;
  email?: string;
  phoneNumber?: string;
  gender?: string;
  dateOfBirth?: string;
}

export interface Conversation {
  id: string; // e.g. "facebook:thread_123"
  platform: 'facebook' | 'instagram';
  title: string;
  isGroup: boolean;
  participants: string[]; // List of participant names
  lastMessageText?: string;
  lastMessageTimestamp: number; // Epoch ms
  messageCount: number;
}

export interface MessageAttachment {
  relativePath: string;
  type: 'photo' | 'video' | 'audio' | 'file';
  blobUrl?: string; // Dynamically resolved at runtime
}

export interface MessageReaction {
  sender: string;
  reaction: string;
}

export interface Message {
  id: string; // e.g. "facebook:msg_123"
  conversationId: string;
  platform: 'facebook' | 'instagram';
  senderName: string;
  isFromUser: boolean;
  content: string;
  timestamp: number; // Epoch ms
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
}

export interface PostMedia {
  relativePath: string;
  type: 'photo' | 'video';
  blobUrl?: string; // Dynamically resolved at runtime
}

export interface Post {
  id: string; // e.g. "facebook:post_123"
  platform: 'facebook' | 'instagram';
  type: 'post' | 'story' | 'reel';
  content: string; // Caption or post body
  timestamp: number; // Epoch ms
  media: PostMedia[];
  likesCount?: number;
  commentsCount?: number;
}

/** Origin of a media file inside the Meta export tree */
export type MediaSource = 'post' | 'story' | 'message' | 'other';

export interface MediaAttachment {
  id: string; // e.g. "facebook:media_123"
  platform: 'facebook' | 'instagram';
  relativePath: string; // Path inside the ZIP
  type: 'photo' | 'video' | 'audio' | 'file';
  source: MediaSource;
  timestamp: number; // Epoch ms
  associatedId?: string; // Message ID or Post ID
}

export interface AdTargeting {
  id: string; // e.g. "facebook:ad_data"
  platform: 'facebook' | 'instagram';
  interests: string[]; // List of ad interests
  advertisers: string[]; // List of advertisers who uploaded contact list
  history?: Array<{
    advertiserName: string;
    action: string;
    timestamp: number;
  }>;
}
