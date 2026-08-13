import { db } from '../db/db';
import type { Conversation, Message, Post } from '../db/models';

export type GlobalSearchHit =
  | {
      kind: 'message';
      id: string;
      title: string;
      snippet: string;
      timestamp: number;
      conversationId: string;
      messageId: string;
      platform: Message['platform'];
    }
  | {
      kind: 'post';
      id: string;
      title: string;
      snippet: string;
      timestamp: number;
      postId: string;
      mediaId?: string;
      platform: Post['platform'];
    };

function snippetAround(text: string, query: string, radius = 72): string {
  const lower = text.toLowerCase();
  const index = lower.indexOf(query);
  if (index < 0) return text.slice(0, radius * 2);
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + query.length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

export async function searchCapsule(rawQuery: string, limit = 24): Promise<GlobalSearchHit[]> {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) return [];

  const [conversations, messageHits, postHits] = await Promise.all([
    db.conversations.toArray(),
    db.messages
      .filter((msg) => Boolean(msg.content) && msg.content.toLowerCase().includes(query))
      .limit(limit)
      .toArray(),
    db.posts
      .filter((post) => Boolean(post.content) && post.content.toLowerCase().includes(query))
      .limit(limit)
      .toArray()
  ]);

  const convById = new Map<string, Conversation>(conversations.map((conv) => [conv.id, conv]));

  const mediaForPosts = await Promise.all(
    postHits.map((post) =>
      db.media.filter((item) => item.associatedId === post.id).first()
    )
  );

  const messages: GlobalSearchHit[] = messageHits.map((msg) => ({
    kind: 'message',
    id: `msg:${msg.id}`,
    title: convById.get(msg.conversationId)?.title || msg.senderName,
    snippet: snippetAround(msg.content, query),
    timestamp: msg.timestamp,
    conversationId: msg.conversationId,
    messageId: msg.id,
    platform: msg.platform
  }));

  const posts: GlobalSearchHit[] = postHits.map((post, index) => ({
    kind: 'post',
    id: `post:${post.id}`,
    title: post.type === 'story' ? 'Story' : post.type === 'reel' ? 'Reel' : 'Publication',
    snippet: snippetAround(post.content, query),
    timestamp: post.timestamp,
    postId: post.id,
    mediaId: mediaForPosts[index]?.id,
    platform: post.platform
  }));

  return [...messages, ...posts]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}
