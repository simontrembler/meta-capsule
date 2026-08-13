import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useArchive } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../db/db';
import type { Conversation, Message, MessageAttachment } from '../db/models';
import { getMediaBlobUrl, type MediaArchiveSource } from '../utils/zipMediaResolver';
import { filenameFromPath, triggerDownloadFromUrl } from '../utils/download';
import { downloadConversationHtml } from '../utils/memories';
import { Search, MessageSquare, ArrowLeft, AlertCircle, FileText, Mic, Download } from 'lucide-react';

const MessageMedia: React.FC<{
  attachment: MessageAttachment;
  archiveSource: MediaArchiveSource | File | null;
}> = ({ attachment, archiveSource }) => {
  const { t } = useLanguage();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileName = filenameFromPath(attachment.relativePath);

  useEffect(() => {
    if (!archiveSource) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const resolveMedia = async () => {
      try {
        setIsLoading(true);
        const url = await getMediaBlobUrl(archiveSource, attachment.relativePath);
        if (isMounted) {
          setBlobUrl(url);
          setError(false);
        }
      } catch (err) {
        console.error('Failed to resolve media:', err);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void resolveMedia();
    return () => {
      isMounted = false;
    };
  }, [attachment.relativePath, archiveSource]);

  if (!archiveSource) {
    return (
      <div className="flex items-center gap-2 p-3 bg-ink-100 rounded-md text-xs text-ink-500 max-w-xs border border-ink-200">
        <AlertCircle size={14} className="text-brand-600 shrink-0" />
        <span>{t('messages.reselectZip')}</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-48 h-32 rounded-md bg-ink-100 flex items-center justify-center border border-ink-200">
        <div className="w-5 h-5 border-2 border-ink-300 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-50 rounded-md text-xs text-red-600 max-w-xs border border-red-100">
        <AlertCircle size={14} className="shrink-0" />
        <span>{t('messages.mediaError')}</span>
      </div>
    );
  }

  if (attachment.type === 'photo') {
    return (
      <div className="relative max-w-xs group">
        <div className="overflow-hidden rounded-md border border-ink-200">
          <img src={blobUrl} alt="" className="w-full max-h-60 object-cover" />
        </div>
        <button
          type="button"
          onClick={() => triggerDownloadFromUrl(blobUrl, fileName)}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-ink-950/80 px-2 py-1 text-[10px] font-semibold text-brand-50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          title={t('messages.downloadPhoto')}
        >
          <Download size={12} />
          {t('common.download')}
        </button>
      </div>
    );
  }

  if (attachment.type === 'video') {
    return (
      <div className="relative max-w-xs rounded-md overflow-hidden border border-ink-200 bg-black">
        <video src={blobUrl} controls className="w-full max-h-60" />
      </div>
    );
  }

  if (attachment.type === 'audio') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-md bg-ink-50 border border-ink-200 max-w-xs">
        <div className="w-9 h-9 rounded-full bg-ink-100 text-ink-700 flex items-center justify-center shrink-0">
          <Mic size={16} />
        </div>
        <audio src={blobUrl} controls preload="metadata" className="w-44 max-w-full h-8" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => triggerDownloadFromUrl(blobUrl, fileName)}
      className="flex items-center gap-2.5 p-3 bg-ink-50 hover:bg-ink-100 rounded-md text-xs text-ink-800 max-w-xs border border-ink-200 transition-colors"
    >
      <FileText size={16} className="text-brand-600 shrink-0" />
      <span className="truncate font-semibold">{fileName}</span>
    </button>
  );
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedText({
  text,
  query,
  isMe
}: {
  text: string;
  query: string;
  isMe: boolean;
}) {
  const trimmed = query.trim();
  if (!trimmed) {
    return <>{text}</>;
  }

  const parts = text.split(new RegExp(`(${escapeRegExp(trimmed)})`, 'gi'));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark
            key={`${part}-${index}`}
            className={
              isMe
                ? 'bg-brand-400/50 text-inherit rounded-sm px-0.5'
                : 'bg-brand-200 text-ink-950 rounded-sm px-0.5'
            }
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

function monthKeyFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key: string, dateLocale: string): string {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const labelRaw = date.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
  return labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);
}

const MessageRow: React.FC<{
  msg: Message;
  prevMsg?: Message;
  highlightQuery: string;
  isTarget: boolean;
  archiveSource: MediaArchiveSource | File | null;
  dateLocale: string;
  t: (key: 'messages.reactedBy', vars?: Record<string, string | number>) => string;
}> = ({ msg, prevMsg, highlightQuery, isTarget, archiveSource, dateLocale, t }) => {
  const isMe = msg.isFromUser;
  const showSenderName = !isMe && (!prevMsg || prevMsg.senderName !== msg.senderName);
  const showDateDivider = !prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();

  return (
    <div className={`space-y-1 px-3 sm:px-6 ${isTarget ? 'bg-brand-50/80 rounded-md' : ''}`}>
      {showDateDivider && (
        <div className="flex justify-center my-4">
          <span className="px-3 py-1 rounded-full bg-ink-200/60 text-ink-500 text-[10px] font-bold uppercase tracking-wider">
            {new Date(msg.timestamp).toLocaleDateString(dateLocale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </span>
        </div>
      )}

      {showSenderName && (
        <div className="text-[11px] text-ink-400 font-bold ml-3.5 mt-2">{msg.senderName}</div>
      )}

      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[70%] rounded-md px-4 py-2.5 text-sm flex flex-col gap-1.5 ${
            isMe ? 'bg-ink-950 text-brand-50' : 'bg-white text-ink-900 border border-ink-200'
          }`}
        >
          {msg.content && (
            <p className="mc-selectable leading-relaxed whitespace-pre-wrap break-words font-medium">
              {highlightQuery ? (
                <HighlightedText text={msg.content} query={highlightQuery} isMe={isMe} />
              ) : (
                msg.content
              )}
            </p>
          )}

          {msg.attachments && (
            <div className="space-y-2 mt-1">
              {msg.attachments.map((att, attIdx) => (
                <MessageMedia key={attIdx} attachment={att} archiveSource={archiveSource} />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 mt-0.5">
            {msg.reactions && msg.reactions.length > 0 && (
              <div className="flex gap-1">
                {msg.reactions.map((reaction, rIdx) => (
                  <span
                    key={rIdx}
                    className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-ink-50 border border-ink-200 text-xs"
                    title={t('messages.reactedBy', { name: reaction.sender })}
                  >
                    {reaction.reaction}
                  </span>
                ))}
              </div>
            )}
            <span className="text-[9px] font-semibold block ml-auto text-ink-400">
              {new Date(msg.timestamp).toLocaleTimeString(dateLocale, {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const MessagingModule: React.FC = () => {
  const {
    getArchiveSource,
    requestedConversationId,
    requestedMessageId,
    clearRequestedConversation
  } = useArchive();
  const { t, dateLocale } = useLanguage();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isSearchingChat, setIsSearchingChat] = useState(false);
  const [monthJumpKey, setMonthJumpKey] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const pendingScrollId = useRef<string | null>(null);

  useEffect(() => {
    const loadConversations = async () => {
      const list = await db.conversations.orderBy('lastMessageTimestamp').reverse().toArray();
      setConversations(list);
      setFilteredConversations(list);
    };
    void loadConversations();
  }, []);

  useEffect(() => {
    if (!requestedConversationId || conversations.length === 0) return;
    const match = conversations.find((conv) => conv.id === requestedConversationId);
    if (match) {
      pendingScrollId.current = requestedMessageId;
      setTargetMessageId(requestedMessageId);
      setActiveConv(match);
      clearRequestedConversation();
    }
  }, [requestedConversationId, requestedMessageId, conversations, clearRequestedConversation]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredConversations(
        conversations.filter(
          (conv) =>
            conv.title.toLowerCase().includes(query) ||
            conv.participants.some((participant) => participant.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, conversations]);

  const loadThread = useCallback(async (convId: string) => {
    setIsLoadingMessages(true);
    setChatSearchQuery('');
    setIsSearchingChat(false);
    setMonthJumpKey('');
    try {
      const fetched = await db.messages.where('conversationId').equals(convId).sortBy('timestamp');
      setAllMessages(fetched);
    } catch (err) {
      console.error('Error loading messages:', err);
      setAllMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (activeConv) {
      void loadThread(activeConv.id);
    } else {
      setAllMessages([]);
    }
  }, [activeConv, loadThread]);

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const msg of allMessages) {
      if (msg.timestamp) keys.add(monthKeyFromTimestamp(msg.timestamp));
    }
    return Array.from(keys);
  }, [allMessages]);

  const displayedMessages = useMemo(() => {
    if (isSearchingChat && chatSearchQuery.trim()) {
      const query = chatSearchQuery.toLowerCase();
      return allMessages.filter((msg) => msg.content.toLowerCase().includes(query));
    }
    if (monthJumpKey) {
      return allMessages.filter((msg) => monthKeyFromTimestamp(msg.timestamp) === monthJumpKey);
    }
    return allMessages;
  }, [allMessages, chatSearchQuery, isSearchingChat, monthJumpKey]);

  const virtualizer = useVirtualizer({
    count: displayedMessages.length,
    getScrollElement: () => chatContainerRef.current,
    estimateSize: () => 96,
    overscan: 14,
    getItemKey: (index) => displayedMessages[index]?.id ?? index
  });

  useLayoutEffect(() => {
    if (isLoadingMessages || displayedMessages.length === 0) return;

    const targetId = pendingScrollId.current;
    if (targetId) {
      const index = displayedMessages.findIndex((msg) => msg.id === targetId);
      if (index >= 0) {
        virtualizer.scrollToIndex(index, { align: 'center' });
      } else {
        virtualizer.scrollToIndex(displayedMessages.length - 1, { align: 'end' });
      }
      pendingScrollId.current = null;
      return;
    }

    if (!isSearchingChat && !monthJumpKey) {
      virtualizer.scrollToIndex(displayedMessages.length - 1, { align: 'end' });
    } else {
      virtualizer.scrollToOffset(0);
    }
  }, [displayedMessages.length, isLoadingMessages, isSearchingChat, monthJumpKey, activeConv?.id]);

  const handleChatSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!chatSearchQuery.trim()) {
      setIsSearchingChat(false);
      return;
    }
    setMonthJumpKey('');
    setIsSearchingChat(true);
  };

  const clearChatSearch = () => {
    setChatSearchQuery('');
    setIsSearchingChat(false);
  };

  const jumpToMonth = (key: string) => {
    setIsSearchingChat(false);
    setChatSearchQuery('');
    setMonthJumpKey(key);
  };

  const exportActiveThread = () => {
    if (!activeConv) return;
    downloadConversationHtml(activeConv, allMessages);
  };

  return (
    <div className="h-[calc(100dvh-3.5rem-3.5rem-env(safe-area-inset-bottom,0px))] md:h-[calc(100vh-4rem)] flex overflow-hidden bg-ink-50">
      <div className={`w-full md:w-80 border-r border-ink-200 bg-white flex flex-col h-full shrink-0 ${activeConv ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-ink-100">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" size={16} />
            <input
              type="text"
              placeholder={t('messages.searchContact')}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-md bg-ink-50 border border-ink-200 hover:border-ink-200 focus:border-brand-500 focus:bg-white text-sm font-semibold outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-ink-100">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => {
              const isActive = activeConv?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConv(conv)}
                  className={`w-full p-4 flex items-start gap-3 text-left transition-colors ${
                    isActive ? 'bg-brand-50' : 'hover:bg-ink-50'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-ink-100 text-ink-700 flex items-center justify-center font-semibold text-sm">
                      {conv.title.charAt(0)}
                    </div>
                    <span
                      className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-semibold text-white uppercase ${
                        conv.platform === 'facebook'
                          ? 'bg-blue-600'
                          : 'bg-gradient-to-tr from-amber-500 via-red-500 to-purple-600'
                      }`}
                    >
                      {conv.platform.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <h4 className="font-bold text-ink-900 text-sm truncate">{conv.title}</h4>
                      <span className="text-[10px] text-ink-400 font-semibold shrink-0">
                        {new Date(conv.lastMessageTimestamp).toLocaleDateString(dateLocale, {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-ink-500 truncate font-medium">
                      {conv.lastMessageText || t('messages.noMessage')}
                    </p>
                    <span className="inline-block mt-1 text-[10px] text-ink-400 font-bold uppercase tracking-wider">
                      {t('messages.messagesCount', { count: conv.messageCount.toLocaleString(dateLocale) })}
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <MessageSquare size={32} className="text-ink-300 mx-auto mb-2" />
              <p className="text-ink-400 text-sm font-medium">{t('messages.noConversations')}</p>
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col h-full bg-ink-50 ${!activeConv ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {activeConv ? (
          <>
            <div className="min-h-14 md:h-16 bg-white border-b border-ink-200 px-3 sm:px-6 py-2 flex items-center justify-between shrink-0 gap-2 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setActiveConv(null)}
                  className="p-2 -ml-2 rounded-md text-ink-400 hover:bg-ink-50 hover:text-ink-800 md:hidden"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="w-10 h-10 rounded-full bg-ink-100 text-ink-700 flex items-center justify-center font-semibold text-sm shrink-0">
                  {activeConv.title.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-ink-950 text-sm md:text-base truncate leading-none mb-1">
                    {activeConv.title}
                  </h3>
                  <p className="text-xs text-ink-400 truncate font-semibold">{activeConv.participants.join(', ')}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={exportActiveThread}
                  title={t('messages.exportThreadTitle')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">{t('messages.exportThread')}</span>
                </button>
                {monthOptions.length > 0 && (
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                    <span className="hidden sm:inline">{t('messages.jumpTo')}</span>
                    <select
                      value={monthJumpKey}
                      onChange={(event) => jumpToMonth(event.target.value)}
                      className="max-w-[9.5rem] rounded-md border border-ink-200 bg-ink-50 px-2 py-1.5 text-xs font-semibold text-ink-800 outline-none focus:border-brand-500"
                    >
                      <option value="">{t('messages.jumpToAll')}</option>
                      {monthOptions.map((key) => (
                        <option key={key} value={key}>
                          {formatMonthLabel(key, dateLocale)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <form onSubmit={handleChatSearch} className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('messages.searchInChat')}
                      value={chatSearchQuery}
                      onChange={(event) => setChatSearchQuery(event.target.value)}
                      className="pl-3 pr-8 py-1.5 rounded-md bg-ink-50 border border-ink-200 hover:border-ink-200 focus:border-brand-500 focus:bg-white text-xs font-semibold outline-none transition-all w-36 sm:w-48"
                    />
                    {isSearchingChat && (
                      <button
                        type="button"
                        onClick={clearChatSearch}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-md bg-ink-950 hover:bg-ink-800 text-brand-50 text-xs font-semibold transition-colors"
                  >
                    {t('messages.search')}
                  </button>
                </form>
              </div>
            </div>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
              {isLoadingMessages && (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 border-2 border-ink-300 border-t-brand-600 rounded-full animate-spin"></div>
                </div>
              )}

              {isSearchingChat && (
                <div className="sticky top-0 z-10 mx-3 sm:mx-6 mt-3 bg-brand-50 border border-brand-200 rounded-md p-3 text-center text-xs text-brand-800 font-semibold flex items-center justify-between">
                  <span>{t('messages.searchResults', { count: displayedMessages.length, query: chatSearchQuery })}</span>
                  <button onClick={clearChatSearch} className="text-brand-700 hover:text-brand-900 underline">
                    {t('messages.backToChat')}
                  </button>
                </div>
              )}

              {monthJumpKey && (
                <div className="sticky top-0 z-10 mx-3 sm:mx-6 mt-3 bg-ink-100 border border-ink-200 rounded-md p-3 text-center text-xs text-ink-700 font-semibold flex items-center justify-between">
                  <span>{formatMonthLabel(monthJumpKey, dateLocale)}</span>
                  <button onClick={() => jumpToMonth('')} className="text-ink-600 hover:text-ink-900 underline">
                    {t('messages.backToChat')}
                  </button>
                </div>
              )}

              {monthJumpKey && displayedMessages.length === 0 && !isLoadingMessages && (
                <p className="text-center text-sm text-ink-400 py-8">{t('messages.monthEmpty')}</p>
              )}

              <div
                className="relative w-full py-3"
                style={{ height: `${virtualizer.getTotalSize()}px` }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const msg = displayedMessages[virtualRow.index];
                  if (!msg) return null;
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className="absolute top-0 left-0 w-full pb-4"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <MessageRow
                        msg={msg}
                        prevMsg={displayedMessages[virtualRow.index - 1]}
                        highlightQuery={isSearchingChat ? chatSearchQuery : ''}
                        isTarget={targetMessageId === msg.id}
                        archiveSource={getArchiveSource(msg.platform)}
                        dateLocale={dateLocale}
                        t={t}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center p-8">
            <div className="w-16 h-16 border border-ink-200 text-ink-600 flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={28} />
            </div>
            <h3 className="font-display text-lg font-semibold text-ink-950 mb-1">{t('messages.emptyTitle')}</h3>
            <p className="text-ink-400 text-sm max-w-sm mx-auto leading-relaxed">{t('messages.emptyBody')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
