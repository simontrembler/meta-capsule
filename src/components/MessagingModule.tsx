import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useArchive } from '../context/ArchiveContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../db/db';
import type { Conversation, Message, MessageAttachment } from '../db/models';
import { getMediaBlobUrl } from '../utils/zipMediaResolver';
import Dexie from 'dexie';
import { Search, MessageSquare, ArrowLeft, AlertCircle, FileText, Mic } from 'lucide-react';

// Helper component to render media attachments dynamically
const MessageMedia: React.FC<{ attachment: MessageAttachment; zipFile: File | null }> = ({ attachment, zipFile }) => {
  const { t } = useLanguage();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!zipFile) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const resolveMedia = async () => {
      try {
        setIsLoading(true);
        const url = await getMediaBlobUrl(zipFile, attachment.relativePath);
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

    resolveMedia();

    return () => {
      isMounted = false;
    };
  }, [attachment.relativePath, zipFile]);

  if (!zipFile) {
    return (
      <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-xl text-xs text-slate-500 max-w-xs border border-slate-200">
        <AlertCircle size={14} className="text-amber-500 shrink-0" />
        <span>{t('messages.reselectZip')}</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-48 h-32 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-xs text-red-600 max-w-xs border border-red-100">
        <AlertCircle size={14} className="shrink-0" />
        <span>{t('messages.mediaError')}</span>
      </div>
    );
  }

  if (attachment.type === 'photo') {
    return (
      <a href={blobUrl} target="_blank" rel="noopener noreferrer" className="block max-w-xs overflow-hidden rounded-xl border border-slate-200 hover:opacity-95 transition-opacity">
        <img src={blobUrl} alt="Attachment" className="w-full max-h-60 object-cover" />
      </a>
    );
  }

  if (attachment.type === 'video') {
    return (
      <div className="relative max-w-xs rounded-xl overflow-hidden border border-slate-200 bg-black">
        <video src={blobUrl} controls className="w-full max-h-60" />
      </div>
    );
  }

  if (attachment.type === 'audio') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 max-w-xs">
        <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
          <Mic size={16} />
        </div>
        <audio src={blobUrl} controls preload="metadata" className="w-44 max-w-full h-8" />
      </div>
    );
  }

  return (
    <a
      href={blobUrl}
      download={attachment.relativePath.split('/').pop()}
      className="flex items-center gap-2.5 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs text-slate-700 max-w-xs border border-slate-200 transition-colors"
    >
      <FileText size={16} className="text-brand-600 shrink-0" />
      <span className="truncate font-semibold">{attachment.relativePath.split('/').pop()}</span>
    </a>
  );
};

export const MessagingModule: React.FC = () => {
  const { zipFile } = useArchive();
  const { t, dateLocale } = useLanguage();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isSearchingChat, setIsSearchingChat] = useState(false);
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  
  // Pagination State
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const previousScrollHeightRef = useRef<number>(0);

  // 1. Load all conversations on mount
  useEffect(() => {
    const loadConversations = async () => {
      const list = await db.conversations
        .orderBy('lastMessageTimestamp')
        .reverse()
        .toArray();
      setConversations(list);
      setFilteredConversations(list);
    };

    loadConversations();
  }, []);

  // 2. Filter conversations based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = conversations.filter(
        c =>
          c.title.toLowerCase().includes(query) ||
          c.participants.some(p => p.toLowerCase().includes(query))
      );
      setFilteredConversations(filtered);
    }
  }, [searchQuery, conversations]);

  // 3. Load messages for active conversation (Initial load)
  const loadInitialMessages = useCallback(async (convId: string) => {
    setIsLoadingMessages(true);
    setPage(0);
    setHasMore(true);
    setChatSearchQuery('');
    setIsSearchingChat(false);
    setSearchResults([]);

    const limit = 50;
    try {
      const fetched = await db.messages
        .where('[conversationId+timestamp]')
        .between([convId, Dexie.minKey], [convId, Dexie.maxKey])
        .reverse()
        .limit(limit)
        .toArray();

      const chronological = [...fetched].reverse();
      setMessages(chronological);
      setPage(1);
      setHasMore(fetched.length === limit);
      
      // Scroll to bottom after state update
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 50);
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (activeConv) {
      loadInitialMessages(activeConv.id);
    } else {
      setMessages([]);
    }
  }, [activeConv, loadInitialMessages]);

  // 4. Load more messages on scroll up (Infinite Scroll)
  const loadMoreMessages = async () => {
    if (!activeConv || isLoadingMessages || !hasMore || isSearchingChat) return;

    setIsLoadingMessages(true);
    const limit = 50;
    const offset = page * limit;

    if (chatContainerRef.current) {
      previousScrollHeightRef.current = chatContainerRef.current.scrollHeight;
    }

    try {
      const fetched = await db.messages
        .where('[conversationId+timestamp]')
        .between([activeConv.id, Dexie.minKey], [activeConv.id, Dexie.maxKey])
        .reverse()
        .offset(offset)
        .limit(limit)
        .toArray();

      if (fetched.length > 0) {
        const chronological = [...fetched].reverse();
        setMessages(prev => [...chronological, ...prev]);
        setPage(prev => prev + 1);
        setHasMore(fetched.length === limit);

        // Maintain scroll position after prepending items
        setTimeout(() => {
          if (chatContainerRef.current) {
            const container = chatContainerRef.current;
            container.scrollTop = container.scrollHeight - previousScrollHeightRef.current;
          }
        }, 10);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    // If scrolled to top, load more messages
    if (container.scrollTop === 0 && hasMore && !isLoadingMessages && !isSearchingChat) {
      loadMoreMessages();
    }
  };

  // 5. Search within active chat
  const handleChatSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || !chatSearchQuery.trim()) {
      setIsSearchingChat(false);
      setSearchResults([]);
      return;
    }

    setIsSearchingChat(true);
    setIsLoadingMessages(true);

    try {
      const results = await db.messages
        .where('conversationId')
        .equals(activeConv.id)
        .filter(msg => msg.content.toLowerCase().includes(chatSearchQuery.toLowerCase()))
        .toArray();

      // Sort chronologically
      results.sort((a, b) => a.timestamp - b.timestamp);
      setSearchResults(results);
    } catch (err) {
      console.error('Error searching chat:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const clearChatSearch = () => {
    setChatSearchQuery('');
    setIsSearchingChat(false);
    setSearchResults([]);
    if (activeConv) {
      loadInitialMessages(activeConv.id);
    }
  };


  return (
    <div className="h-[calc(100vh-5rem)] flex overflow-hidden bg-slate-50">
      
      {/* Sidebar: Conversations List */}
      <div className={`w-full md:w-80 border-r border-slate-100 bg-white flex flex-col h-full shrink-0 ${activeConv ? 'hidden md:flex' : 'flex'}`}>
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-50">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={t('messages.searchContact')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-brand-300 focus:bg-white text-sm font-semibold outline-none transition-all"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => {
              const isActive = activeConv?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConv(conv)}
                  className={`w-full p-4 flex items-start gap-3 text-left transition-colors ${
                    isActive ? 'bg-brand-50/50' : 'hover:bg-slate-50/30'
                  }`}
                >
                  {/* Platform Icon & Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
                      {conv.title.charAt(0)}
                    </div>
                    <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white uppercase shadow-sm ${
                      conv.platform === 'facebook' ? 'bg-blue-600' : 'bg-gradient-to-tr from-amber-500 via-red-500 to-purple-600'
                    }`}>
                      {conv.platform.charAt(0)}
                    </span>
                  </div>

                  {/* Conversation Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <h4 className="font-bold text-slate-800 text-sm truncate">{conv.title}</h4>
                      <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                        {new Date(conv.lastMessageTimestamp).toLocaleDateString(dateLocale, {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate font-medium">
                      {conv.lastMessageText || t('messages.noMessage')}
                    </p>
                    <span className="inline-block mt-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {t('messages.messagesCount', { count: conv.messageCount.toLocaleString(dateLocale) })}
                    </span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <MessageSquare size={32} className="text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm font-medium">{t('messages.noConversations')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Window */}
      <div className={`flex-1 flex flex-col h-full bg-slate-50 ${!activeConv ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
        {activeConv ? (
          <>
            {/* Chat Header */}
            <div className="h-20 bg-white border-b border-slate-100 px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setActiveConv(null)}
                  className="p-2 -ml-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 md:hidden"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0">
                  {activeConv.title.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-slate-800 text-sm md:text-base truncate leading-none mb-1">
                    {activeConv.title}
                  </h3>
                  <p className="text-xs text-slate-400 truncate font-semibold">
                    {activeConv.participants.join(', ')}
                  </p>
                </div>
              </div>

              {/* Chat Search Form */}
              <form onSubmit={handleChatSearch} className="hidden sm:flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder={t('messages.searchInChat')}
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    className="pl-3 pr-8 py-1.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-brand-300 focus:bg-white text-xs font-semibold outline-none transition-all w-48"
                  />
                  {isSearchingChat && (
                    <button
                      type="button"
                      onClick={clearChatSearch}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-600/10 transition-colors"
                >
                  {t('messages.search')}
                </button>
              </form>
            </div>

            {/* Messages Container */}
            <div
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {/* Loader for infinite scroll */}
              {isLoadingMessages && !isSearchingChat && (
                <div className="flex justify-center py-2">
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin"></div>
                </div>
              )}

              {/* Search Results Header */}
              {isSearchingChat && (
                <div className="sticky top-0 z-10 bg-brand-50 border border-brand-100 rounded-xl p-3 text-center text-xs text-brand-800 font-bold shadow-sm flex items-center justify-between">
                  <span>{t('messages.searchResults', { count: searchResults.length, query: chatSearchQuery })}</span>
                  <button onClick={clearChatSearch} className="text-brand-600 hover:text-brand-800 underline">
                    {t('messages.backToChat')}
                  </button>
                </div>
              )}

              {/* Messages List */}
              {(isSearchingChat ? searchResults : messages).map((msg, idx, arr) => {
                const isMe = msg.isFromUser;
                const prevMsg = arr[idx - 1];
                const showSenderName = !isMe && (!prevMsg || prevMsg.senderName !== msg.senderName);
                const showDateDivider = !prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();

                return (
                  <div key={msg.id} className="space-y-1">
                    {/* Date Divider */}
                    {showDateDivider && (
                      <div className="flex justify-center my-4">
                        <span className="px-3 py-1 rounded-full bg-slate-200/50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                          {new Date(msg.timestamp).toLocaleDateString(dateLocale, {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    )}

                    {/* Sender Name */}
                    {showSenderName && (
                      <div className="text-[11px] text-slate-400 font-bold ml-3.5 mt-2">
                        {msg.senderName}
                      </div>
                    )}

                    {/* Message Bubble Row */}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm flex flex-col gap-1.5 ${
                        isMe
                          ? 'bg-brand-600 text-white rounded-tr-sm'
                          : 'bg-white text-slate-800 border border-slate-100 rounded-tl-sm'
                      }`}>
                        {/* Text Content */}
                        {msg.content && (
                          <p className="leading-relaxed whitespace-pre-wrap break-words font-medium">
                            {msg.content}
                          </p>
                        )}

                        {/* Attachments */}
                        {msg.attachments && (
                          <div className="space-y-2 mt-1">
                            {msg.attachments.map((att, attIdx) => (
                              <MessageMedia key={attIdx} attachment={att} zipFile={zipFile} />
                            ))}
                          </div>
                        )}

                        {/* Timestamp & Reactions */}
                        <div className="flex items-center justify-between gap-4 mt-0.5">
                          {/* Reactions */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className="flex gap-1">
                              {msg.reactions.map((r, rIdx) => (
                                <span
                                  key={rIdx}
                                  className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-xs shadow-sm"
                                  title={t('messages.reactedBy', { name: r.sender })}
                                >
                                  {r.reaction}
                                </span>
                              ))}
                            </div>
                          )}
                          <span className={`text-[9px] font-semibold block ${isMe ? 'text-brand-200 ml-auto' : 'text-slate-400 ml-auto'}`}>
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
              })}
            </div>
          </>
        ) : (
          <div className="text-center p-8">
            <div className="w-16 h-16 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">{t('messages.emptyTitle')}</h3>
            <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
              {t('messages.emptyBody')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
