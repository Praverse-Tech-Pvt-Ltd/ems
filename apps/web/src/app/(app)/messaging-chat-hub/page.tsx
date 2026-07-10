'use client';

import { useState, useEffect, useRef } from 'react';
import { chatService } from '@/lib/api/management';
import { useAuthStore } from '@/store/auth.store';
import { useQueryClient } from '@tanstack/react-query';
import type { ChatChannel, ChatMessage } from '@/types';

export default function MessagingChatHubPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadChannels = async () => {
    try {
      const data = await queryClient.fetchQuery({ queryKey: ['chat-channels'], queryFn: () => chatService.channels() }).catch(() => []);
      const chans = Array.isArray(data) ? data : data?.data ?? [];
      setChannels(chans);
      if (chans.length > 0 && !activeChannel) {
        setActiveChannel(chans[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (channelId: string) => {
    setMsgLoading(true);
    try {
      const data = await queryClient.fetchQuery({ queryKey: ['chat-messages', channelId], queryFn: () => chatService.messages(channelId, { limit: 50 }) }).catch(() => []);
      const msgs = Array.isArray(data) ? data : data?.data ?? data?.messages ?? [];
      setMessages(msgs.reverse());
      await chatService.markRead(channelId).catch(() => {});
    } finally {
      setMsgLoading(false);
    }
  };

  useEffect(() => { loadChannels(); }, []);

  useEffect(() => {
    if (activeChannel) {
      loadMessages(activeChannel.id);
    }
  }, [activeChannel?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !activeChannel) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      await chatService.send(activeChannel.id, text);
      await loadMessages(activeChannel.id);
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getChannelName = (ch: ChatChannel) => {
    if (ch.type === 'DIRECT' && ch.otherMember) {
      return `${ch.otherMember.firstName} ${ch.otherMember.lastName}`;
    }
    return ch.name;
  };

  const getChannelInitials = (ch: ChatChannel) => {
    if (ch.type === 'DIRECT' && ch.otherMember) {
      return `${ch.otherMember.firstName[0]}${ch.otherMember.lastName[0]}`;
    }
    return ch.name?.slice(0, 2).toUpperCase() ?? '??';
  };

  const groupChannels = channels.filter(c => c.type !== 'DIRECT');
  const dmChannels = channels.filter(c => c.type === 'DIRECT');

  return (
    <div className="flex flex-col gap-lg">
      {/* Header */}
      <div className="border-b border-outline-variant/30 pb-sm">
        <div className="font-label-caps text-label-caps text-primary tracking-widest flex items-center gap-xs mb-xs">
          <span className="material-symbols-outlined text-[18px]">forum</span>
          MESSAGING
        </div>
        <h2 className="font-display-lg text-display-lg text-on-surface hidden md:block">Chat Hub</h2>
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:hidden">Chat Hub</h2>
        <p className="text-on-surface-variant mt-xs">Direct messages, team channels, and announcements.</p>
      </div>

      {/* Chat interface */}
      <div className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden" style={{ height: '70vh', minHeight: '520px' }}>
        <div className="flex h-full">
          {/* Sidebar */}
          <aside className={`w-full md:w-64 border-r border-outline-variant/20 flex-col shrink-0 ${activeChannel ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-sm border-b border-outline-variant/20">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">search</span>
                <input className="min-h-11 w-full pl-8 pr-sm py-2 bg-surface-container-lowest rounded-lg text-body-sm border border-outline-variant/30 focus:border-primary focus:ring-0 focus:outline-none" placeholder="Search..." />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col gap-xs p-sm">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-12 rounded-lg bg-surface-container-high animate-pulse" />)}
                </div>
              ) : (
                <>
                  {groupChannels.length > 0 && (
                    <>
                      <p className="px-sm pt-sm pb-xs font-label-caps text-[9px] text-on-surface-variant tracking-widest">CHANNELS</p>
                      {groupChannels.map(ch => (
                        <button key={ch.id} onClick={() => setActiveChannel(ch)}
                          className={`w-full text-left px-sm py-2.5 flex items-center gap-sm hover:bg-surface-container-low transition-colors ${activeChannel?.id === ch.id ? 'bg-secondary-container/50' : ''}`}>
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 text-[11px] font-bold">
                            {getChannelInitials(ch)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-on-surface text-sm truncate">{getChannelName(ch)}</p>
                            <p className="text-[10px] text-on-surface-variant truncate">{ch.lastMessage?.body ?? 'No messages yet'}</p>
                          </div>
                          {ch.unread > 0 && (
                            <span className="bg-primary text-on-primary text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0">{ch.unread}</span>
                          )}
                        </button>
                      ))}
                    </>
                  )}

                  {dmChannels.length > 0 && (
                    <>
                      <p className="px-sm pt-sm pb-xs font-label-caps text-[9px] text-on-surface-variant tracking-widest">DIRECT MESSAGES</p>
                      {dmChannels.map(ch => (
                        <button key={ch.id} onClick={() => setActiveChannel(ch)}
                          className={`w-full text-left px-sm py-2.5 flex items-center gap-sm hover:bg-surface-container-low transition-colors ${activeChannel?.id === ch.id ? 'bg-secondary-container/50' : ''}`}>
                          <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs shrink-0">
                            {getChannelInitials(ch)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-on-surface text-sm truncate">{getChannelName(ch)}</p>
                            <p className="text-[10px] text-on-surface-variant truncate">{ch.lastMessage?.body ?? 'No messages yet'}</p>
                          </div>
                          {ch.unread > 0 && (
                            <span className="bg-primary text-on-primary text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0">{ch.unread}</span>
                          )}
                        </button>
                      ))}
                    </>
                  )}

                  {channels.length === 0 && (
                    <div className="p-md text-center text-on-surface-variant text-body-sm">
                      No channels yet.
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>

          {/* Main chat area */}
          <div className={`flex-1 flex-col overflow-hidden ${activeChannel ? 'flex' : 'hidden md:flex'}`}>
            {!activeChannel ? (
              <div className="flex-1 flex items-center justify-center text-on-surface-variant">
                <div className="text-center">
                  <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">forum</span>
                  <p className="mt-sm">{loading ? 'Loading channels...' : 'Select a channel to start chatting'}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Channel header */}
                <div className="p-sm border-b border-outline-variant/20 flex items-center gap-sm">
                  <button onClick={() => setActiveChannel(null)} className="md:hidden w-10 h-10 -ml-1 flex items-center justify-center text-on-surface-variant hover:text-primary shrink-0">
                    <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                  </button>
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    {getChannelInitials(activeChannel)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-on-surface">{getChannelName(activeChannel)}</p>
                    <p className="text-[10px] text-on-surface-variant">{activeChannel.type} · {activeChannel.members?.length ?? 0} members</p>
                  </div>
                  <div className="flex gap-sm text-on-surface-variant">
                    <button className="hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-[20px]">more_vert</span>
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-sm flex flex-col gap-sm">
                  {msgLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-on-surface-variant text-body-sm">
                      No messages yet. Say hello!
                    </div>
                  ) : (
                    messages.map(msg => {
                      const isMe = msg.author?.id === user?.id;
                      return (
                        <div key={msg.id} className={`flex gap-sm ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          {!isMe && (
                            <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                              {msg.author?.firstName?.[0]}{msg.author?.lastName?.[0]}
                            </div>
                          )}
                          <div className={`max-w-[72%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                            {!isMe && (
                              <p className="text-[10px] text-on-surface-variant px-1">{msg.author?.firstName} {msg.author?.lastName}</p>
                            )}
                            <div className={`rounded-2xl px-sm py-2 ${isMe ? 'bg-primary text-on-primary rounded-tr-sm' : 'bg-surface-container-lowest border border-outline-variant/30 text-on-surface rounded-tl-sm'}`}>
                              <p className="text-sm leading-relaxed">{msg.body}</p>
                            </div>
                            <p className="text-[9px] text-on-surface-variant/60 px-1">
                              {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-sm border-t border-outline-variant/20">
                  <div className="flex items-center gap-sm bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-sm py-2">
                    <input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={`Message ${getChannelName(activeChannel)}...`}
                      className="flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none text-body-sm text-on-surface placeholder:text-on-surface-variant/50"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || sending}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${input.trim() && !sending ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                      <span className="material-symbols-outlined text-[16px]">{sending ? 'hourglass_empty' : 'send'}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
