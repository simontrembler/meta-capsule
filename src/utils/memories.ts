import { db } from '../db/db';
import type { Conversation, MediaAttachment, Message } from '../db/models';

export function monthDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}-${date.getDate()}`;
}

export function todayMonthDayKey(now = new Date()): string {
  return `${now.getMonth() + 1}-${now.getDate()}`;
}

export async function loadOnThisDay(limit = 12): Promise<{
  messages: Message[];
  media: MediaAttachment[];
}> {
  const key = todayMonthDayKey();
  const [allMessages, allMedia] = await Promise.all([
    db.messages.toArray(),
    db.media.toArray()
  ]);

  const messages = allMessages
    .filter((msg) => monthDayKey(msg.timestamp) === key && msg.content)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  const media = allMedia
    .filter((item) => monthDayKey(item.timestamp) === key && item.type === 'photo')
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

  return { messages, media };
}

export async function loadTopConversations(limit = 8): Promise<Conversation[]> {
  const all = await db.conversations.toArray();
  return all.sort((a, b) => b.messageCount - a.messageCount).slice(0, limit);
}

export function downloadConversationHtml(conversation: Conversation, messages: Message[]): void {
  const escaped = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

  const rows = messages
    .map((msg) => {
      const when = new Date(msg.timestamp).toLocaleString();
      return `<article>
  <header><strong>${escaped(msg.senderName)}</strong> · <time>${escaped(when)}</time></header>
  <p>${escaped(msg.content || '')}</p>
</article>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escaped(conversation.title)}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 40rem; margin: 2rem auto; color: #1c1b1a; }
    article { margin: 1rem 0; padding-bottom: 1rem; border-bottom: 1px solid #eee; }
    header { font-size: 0.85rem; color: #6f6a63; }
  </style>
</head>
<body>
  <h1>${escaped(conversation.title)}</h1>
  <p>Export Meta Capsule — local, hors-ligne.</p>
  ${rows}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = conversation.title.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'conversation';
  link.href = url;
  link.download = `${safeName}.html`;
  link.click();
  URL.revokeObjectURL(url);
}
