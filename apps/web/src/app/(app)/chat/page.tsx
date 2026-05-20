'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api-client';
import { useChat } from '@/hooks/useChat';
import { initials } from '@/lib/utils';
import type { ChatChannel, ChatMessage, Employee } from '@/types';
import {
  Hash, MessageSquare, Plus, Send, Users, X, Search,
  Loader2, Wifi, WifiOff, ChevronLeft, MoreVertical,
  CheckSquare, Trash2, LogOut,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function channelIcon(type: ChatChannel['type']) {
  if (type === 'GENERAL') return <Hash size={13} />;
  if (type === 'GROUP') return <Users size={13} />;
  return <MessageSquare size={13} />;
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'lg' }) {
  const parts = name.trim().split(' ');
  const ini = initials(parts[0] ?? '', parts[1] ?? '');
  const sz = size === 'lg' ? 'w-9 h-9 text-[13px]' : 'w-8 h-8 text-[11px]';
  return (
    <div className={`${sz} rounded-full grid place-items-center bg-brutal-ink text-brutal-yellow font-display font-bold shrink-0 border-2 border-brutal-ink`}>
      {ini}
    </div>
  );
}

// ─── DM Modal ────────────────────────────────────────────────────────────────

function NewDMModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (ch: ChatChannel) => void;
}) {
  const [q, setQ] = useState('');
  const { data: colleagues = [] } = useQuery<Employee[]>({
    queryKey: ['colleagues'],
    queryFn: () => apiClient.get('/employees/colleagues').then((r) => r.data),
  });
  const mutation = useMutation({
    mutationFn: (otherId: string) =>
      apiClient.post('/chat/channels/direct', { otherId }).then((r) => r.data),
    onSuccess: onCreated,
  });
  const filtered = useMemo(
    () => colleagues.filter((c) =>
      !q || `${c.firstName} ${c.lastName} ${c.designation ?? ''}`.toLowerCase().includes(q.toLowerCase())
    ),
    [colleagues, q],
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-sm brutal-border brutal-shadow bg-brutal-cream" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 brutal-border-b bg-brutal-yellow">
          <span className="font-display font-bold text-[12px] tracking-[0.2em]">NEW DIRECT MESSAGE</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-3">
          <div className="flex items-stretch brutal-border brutal-shadow-sm mb-3">
            <div className="px-2 grid place-items-center brutal-border-r"><Search size={13} /></div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search colleagues…"
              autoFocus className="flex-1 px-3 py-2 bg-transparent focus:outline-none text-[13px]" />
          </div>
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {filtered.map((c) => (
              <button key={c.id} onClick={() => mutation.mutate(c.id)} disabled={mutation.isPending}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-brutal-blue hover:text-white transition-colors text-left disabled:opacity-50 rounded">
                <Avatar name={`${c.firstName} ${c.lastName}`} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[13px] truncate">{c.firstName} {c.lastName}</div>
                  <div className="text-[11px] opacity-60 truncate">{c.designation ?? c.role}</div>
                </div>
                {mutation.isPending && <Loader2 size={12} className="animate-spin shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-[12px] text-brutal-ink/50 py-6">No colleagues found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar Channel Item ─────────────────────────────────────────────────────

function ChannelItem({ ch, active, onClick, onDelete }: {
  ch: ChatChannel;
  active: boolean;
  onClick: () => void;
  onDelete: (ch: ChatChannel) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const label = ch.type === 'DIRECT' && ch.otherMember
    ? `${ch.otherMember.firstName} ${ch.otherMember.lastName}`
    : ch.name;

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div className={`group/item relative flex items-center border-2 mb-0.5 transition-all ${
      active
        ? 'bg-brutal-blue text-white border-brutal-ink brutal-shadow-sm'
        : 'border-transparent hover:bg-brutal-surface'
    }`}>
      {/* Main clickable row */}
      <button onClick={onClick} className="flex items-center gap-3 px-3 py-2.5 flex-1 min-w-0 text-left">
        {ch.type === 'DIRECT'
          ? <Avatar name={label} />
          : (
            <div className={`w-8 h-8 grid place-items-center border-2 border-brutal-ink shrink-0 rounded ${active ? 'bg-white/20' : 'bg-brutal-surface'}`}>
              {channelIcon(ch.type)}
            </div>
          )
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="font-bold text-[13px] truncate">{label}</span>
            {ch.unread > 0 && (
              <span className="shrink-0 min-w-[20px] h-5 px-1.5 grid place-items-center bg-brutal-red text-white font-bold text-[10px] rounded-full">
                {ch.unread > 99 ? '99+' : ch.unread}
              </span>
            )}
          </div>
          {ch.lastMessage && (
            <p className={`text-[11px] truncate mt-0.5 ${active ? 'text-white/70' : 'text-brutal-ink/50'}`}>
              {ch.lastMessage.author.firstName}: {ch.lastMessage.body}
            </p>
          )}
        </div>
      </button>

      {/* ⋯ menu — only for non-GENERAL channels, appears on row hover */}
      {ch.type !== 'GENERAL' && (
        <div
          ref={menuRef}
          className="relative shrink-0 pr-1 opacity-0 group-hover/item:opacity-100 transition-opacity"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className={`w-7 h-7 grid place-items-center rounded-full transition-colors ${
              active
                ? 'hover:bg-white/20 text-white/70 hover:text-white'
                : 'hover:bg-brutal-surface-dim text-brutal-ink/40 hover:text-brutal-ink'
            }`}
          >
            <MoreVertical size={13} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 z-40 w-48 bg-white brutal-border brutal-shadow py-1">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(ch); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] hover:bg-red-50 text-brutal-red transition-colors text-left"
              >
                {ch.type === 'DIRECT'
                  ? <><Trash2 size={13} className="shrink-0" /> Delete conversation</>
                  : <><LogOut size={13} className="shrink-0" /> Leave group</>
                }
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface MessageBubbleProps {
  msg: ChatMessage;
  isMine: boolean;
  showAvatar: boolean;
  selected: boolean;
  selectMode: boolean;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
}

function MessageBubble({ msg, isMine, showAvatar, selected, selectMode, onDelete, onSelect }: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div
      className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'} items-end group`}
      onClick={() => { if (selectMode) onSelect(msg.id); }}
    >
      {/* Selection checkbox */}
      {selectMode && (
        <div className={`w-5 h-5 shrink-0 self-center rounded border-2 border-brutal-ink flex items-center justify-center cursor-pointer transition-colors ${selected ? 'bg-[#2563EB] border-[#2563EB]' : 'bg-white'}`}>
          {selected && <span className="text-white text-[10px] font-bold">✓</span>}
        </div>
      )}

      {/* Avatar column — left side only */}
      {!selectMode && (
        <div className="w-8 shrink-0">
          {!isMine && showAvatar && (
            <Avatar name={`${msg.author.firstName} ${msg.author.lastName}`} />
          )}
        </div>
      )}

      {/* Content */}
      <div className={`flex flex-col gap-1 max-w-[65%] ${isMine ? 'items-end' : 'items-start'}`}>

        {/* Sender name — only for others, only when avatar shows */}
        {!isMine && showAvatar && !selectMode && (
          <span className="text-[11px] font-semibold text-brutal-ink/60 px-1">
            {msg.author.firstName} {msg.author.lastName}
          </span>
        )}

        {/* Bubble row */}
        <div className={`flex items-center gap-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>

          {/* The bubble */}
          <div className={`
            px-4 py-2.5 text-[14px] leading-relaxed break-words whitespace-pre-wrap max-w-full cursor-${selectMode ? 'pointer' : 'default'}
            transition-opacity ${selected ? 'opacity-70' : 'opacity-100'}
            ${isMine
              ? 'bg-[#2563EB] text-white rounded-[18px] rounded-br-[4px] shadow-md'
              : 'bg-white text-brutal-ink rounded-[18px] rounded-bl-[4px] shadow-sm border border-gray-200'
            }
          `}>
            {msg.body}
          </div>

          {/* Three-dot menu — only when NOT in select mode */}
          {!selectMode && (
            <div className="relative opacity-0 group-hover:opacity-100 transition-opacity" ref={menuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                className="w-7 h-7 grid place-items-center rounded-full hover:bg-gray-200 text-brutal-ink/50 hover:text-brutal-ink transition-colors"
              >
                <MoreVertical size={14} />
              </button>

              {menuOpen && (
                <div className={`absolute z-30 top-8 ${isMine ? 'right-0' : 'left-0'} w-44 bg-white brutal-border brutal-shadow-sm py-1`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onSelect(msg.id); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-brutal-surface transition-colors text-left"
                  >
                    <CheckSquare size={13} className="shrink-0 text-brutal-blue" />
                    Select
                  </button>
                  {isMine && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(msg.id); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-red-50 text-brutal-red transition-colors text-left"
                    >
                      <Trash2 size={13} className="shrink-0" />
                      Delete message
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        {!selectMode && (
          <span className="text-[10px] text-brutal-ink/40 px-1">
            {formatTime(msg.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-xs brutal-border brutal-shadow bg-brutal-cream p-5 text-center space-y-4">
        <p className="font-bold text-[14px]">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={onConfirm}
            className="px-4 py-2 bg-brutal-red text-white font-bold text-[13px] brutal-border brutal-shadow-sm hover:bg-brutal-ink transition-colors">
            Confirm
          </button>
          <button onClick={onCancel}
            className="px-4 py-2 bg-white text-brutal-ink font-bold text-[13px] brutal-border brutal-shadow-sm hover:bg-brutal-yellow transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const authUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  // Live employee profile — avoids stale UUID from auth store
  const { data: myProfile } = useQuery<Employee>({
    queryKey: ['employees-me'],
    queryFn: () => apiClient.get('/employees/me').then((r) => r.data),
    enabled: !!authUser,
  });
  const myId = myProfile?.id ?? authUser?.id ?? '';

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [showDM, setShowDM] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);

  // ── Multi-select state ─────────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Header three-dot menu state ────────────────────────────────────────────
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  // ── Confirm dialog state ───────────────────────────────────────────────────
  const [confirm, setConfirm] = useState<{ msg: string; action: () => void } | null>(null);

  const messagesBoxRef   = useRef<HTMLDivElement>(null);
  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef      = useRef(false);
  const activeChannelRef = useRef<string | null>(null);

  // Close header menu on outside click
  useEffect(() => {
    if (!headerMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [headerMenuOpen]);

  // ── Channels ──────────────────────────────────────────────────────────────
  const { data: channels = [], isLoading: chLoading } = useQuery<ChatChannel[]>({
    queryKey: ['chat-channels'],
    queryFn: () => apiClient.get('/chat/channels').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;

  useEffect(() => {
    if (!activeChannelId && channels.length > 0 && channels[0]) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  useEffect(() => {
    activeChannelRef.current = activeChannelId;
  }, [activeChannelId]);

  // ── Messages ──────────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (cid: string, cursor?: string) => {
    const url = `/chat/channels/${cid}/messages${cursor ? `?cursor=${cursor}&limit=30` : '?limit=30'}`;
    return apiClient.get(url).then((r) => r.data) as Promise<{
      messages: ChatMessage[];
      hasMore: boolean;
      nextCursor: string | null;
    }>;
  }, []);

  useEffect(() => {
    if (!activeChannelId) return;
    setMessages([]);
    setOldestCursor(null);
    setHasMore(false);
    setSelectMode(false);
    setSelectedIds(new Set());
    loadMessages(activeChannelId).then(({ messages: msgs, hasMore: hm, nextCursor }) => {
      setMessages(msgs);
      setHasMore(hm);
      setOldestCursor(nextCursor);
    });
    setSidebarOpen(false);
  }, [activeChannelId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Socket callbacks ──────────────────────────────────────────────────────
  const handleNewMessage = useCallback((msg: ChatMessage) => {
    if (msg.channelId === activeChannelRef.current) {
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    }
    queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
  }, [queryClient]);

  const handleTyping = useCallback((data: { employeeId: string; isTyping: boolean }) => {
    if (data.employeeId === myId) return;
    setTypingUsers((prev) => {
      const next = new Set(prev);
      data.isTyping ? next.add(data.employeeId) : next.delete(data.employeeId);
      return next;
    });
  }, [myId]);

  const handleDeleted = useCallback((data: { messageId: string; channelId: string }) => {
    if (data.channelId === activeChannelRef.current) {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(data.messageId); return next; });
    }
    queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
  }, [queryClient]);

  const handleMessagesDeleted = useCallback((data: { channelId: string; messageIds: string[] }) => {
    if (data.channelId === activeChannelRef.current) {
      const deleted = new Set(data.messageIds);
      setMessages((prev) => prev.filter((m) => !deleted.has(m.id)));
      setSelectedIds((prev) => { const next = new Set(prev); data.messageIds.forEach((id) => next.delete(id)); return next; });
    }
    queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
  }, [queryClient]);

  const handleConversationDeleted = useCallback((data: { channelId: string; action: 'deleted' | 'left' }) => {
    // Remove from channel list and clear the view if it was active
    queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
    if (data.channelId === activeChannelRef.current) {
      setActiveChannelId(null);
      setMessages([]);
      setSelectMode(false);
      setSelectedIds(new Set());
      activeChannelRef.current = null;
    }
  }, [queryClient]);

  const { connected, sendMessage, deleteMessage, deleteMessages, deleteConversation, sendTyping, markRead } = useChat({
    employeeId: myId || undefined,
    channelId: activeChannelId,
    onMessage: handleNewMessage,
    onTyping: handleTyping,
    onDeleted: handleDeleted,
    onMessagesDeleted: handleMessagesDeleted,
    onConversationDeleted: handleConversationDeleted,
  });

  useEffect(() => {
    if (activeChannelId && connected) {
      markRead(activeChannelId);
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
    }
  }, [activeChannelId, connected, markRead, queryClient]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !connected) return;
    sendMessage(text);
    setInput('');
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    sendTyping(false);
    isTypingRef.current = false;
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [input, connected, sendMessage, sendTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (!isTypingRef.current) { sendTyping(true); isTypingRef.current = true; }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => { sendTyping(false); isTypingRef.current = false; }, 2000);
  };

  // ── Delete single ─────────────────────────────────────────────────────────
  const handleDeleteSingle = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    deleteMessage(messageId);
    queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
  }, [deleteMessage, queryClient]);

  // ── Select / deselect ─────────────────────────────────────────────────────
  const handleSelect = useCallback((messageId: string) => {
    // Entering select mode on first select
    setSelectMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(messageId) ? next.delete(messageId) : next.add(messageId);
      return next;
    });
  }, []);

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  // ── Bulk delete ───────────────────────────────────────────────────────────
  const handleBulkDelete = useCallback(() => {
    if (!activeChannelId || !selectedIds.size) return;
    const ids = Array.from(selectedIds);
    // Optimistic
    setMessages((prev) => prev.filter((m) => !selectedIds.has(m.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    deleteMessages(activeChannelId, ids);
    queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
  }, [activeChannelId, selectedIds, deleteMessages, queryClient]);

  // ── Delete / leave a channel (shared by sidebar + header) ───────────────────
  const promptDeleteChannel = useCallback((ch: ChatChannel) => {
    setHeaderMenuOpen(false);
    const msgText = ch.type === 'GROUP'
      ? 'Leave this group? You will no longer receive messages from it.'
      : 'Delete this conversation? This cannot be undone.';
    setConfirm({
      msg: msgText,
      action: () => {
        deleteConversation(ch.id);
        setConfirm(null);
      },
    });
  }, [deleteConversation]);

  // Called from the header ⋯ menu (uses the currently active channel)
  const handleDeleteConversation = useCallback(() => {
    const ch = channels.find((c) => c.id === activeChannelId);
    if (ch) promptDeleteChannel(ch);
  }, [activeChannelId, channels, promptDeleteChannel]);

  // ── Load more ─────────────────────────────────────────────────────────────
  const handleLoadMore = async () => {
    if (!activeChannelId || !oldestCursor || loadingMore) return;
    const box = messagesBoxRef.current;
    const prevH = box?.scrollHeight ?? 0;
    setLoadingMore(true);
    try {
      const { messages: older, hasMore: hm, nextCursor } = await loadMessages(activeChannelId, oldestCursor);
      setMessages((prev) => [...older, ...prev]);
      setHasMore(hm);
      setOldestCursor(nextCursor);
      requestAnimationFrame(() => { if (box) box.scrollTop = box.scrollHeight - prevH; });
    } finally {
      setLoadingMore(false);
    }
  };

  const handleChannelSelect = (channelId: string) => {
    setActiveChannelId(channelId);
    queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
  };

  const totalUnread = channels.reduce((s, c) => s + c.unread, 0);

  // Active channel display name
  const activeChannelLabel = activeChannel
    ? (activeChannel.type === 'DIRECT' && activeChannel.otherMember
        ? `${activeChannel.otherMember.firstName} ${activeChannel.otherMember.lastName}`
        : activeChannel.name)
    : '';

  // Which messages are mine (for bulk-delete count label)
  const selectedMineCount = messages.filter((m) => selectedIds.has(m.id) && m.author.id === myId).length;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-80px)] max-w-[1320px] animate-fade-up brutal-border brutal-shadow overflow-hidden bg-white">

      {/* ══ Sidebar ══════════════════════════════════════════════════════════ */}
      <aside className={`
        ${sidebarOpen ? 'flex' : 'hidden'} md:flex flex-col
        w-full md:w-[280px] shrink-0 brutal-border-r bg-brutal-cream
        ${sidebarOpen ? 'absolute md:relative z-20 inset-0' : ''}
      `}>
        {/* Header */}
        <div className="px-4 py-4 brutal-border-b bg-brutal-yellow flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-[10px] tracking-[0.28em] text-brutal-ink/60">— TEAM CHAT</p>
            <div className="font-display font-bold text-[18px] tracking-tight mt-1 flex items-center gap-2">
              WORKSPACE
              {totalUnread > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-brutal-red text-white rounded-full font-bold">{totalUnread}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connected ? <Wifi size={14} className="text-green-600" /> : <WifiOff size={14} className="text-brutal-red animate-pulse" />}
            <button onClick={() => setShowDM(true)}
              className="w-8 h-8 grid place-items-center bg-brutal-ink text-brutal-yellow hover:bg-brutal-blue transition-colors border-2 border-brutal-ink rounded"
              title="New DM">
              <Plus size={15} />
            </button>
          </div>
        </div>

        {/* Channel list */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {chLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin text-brutal-ink/40" /></div>
          ) : channels.length === 0 ? (
            <p className="text-center text-[12px] text-brutal-ink/40 py-10">No channels yet</p>
          ) : (
            (['GENERAL', 'GROUP', 'DIRECT'] as const).map((type) => {
              const typed = channels.filter((c) => c.type === type);
              if (!typed.length) return null;
              const labels: Record<string, string> = { GENERAL: 'Channels', GROUP: 'Groups', DIRECT: 'Direct Messages' };
              return (
                <div key={type} className="mb-4">
                  <p className="px-3 pb-1 text-[10px] font-bold tracking-[0.2em] text-brutal-ink/40 uppercase">{labels[type]}</p>
                  {typed.map((ch) => (
                    <ChannelItem
                      key={ch.id}
                      ch={ch}
                      active={ch.id === activeChannelId}
                      onClick={() => handleChannelSelect(ch.id)}
                      onDelete={promptDeleteChannel}
                    />
                  ))}
                </div>
              );
            })
          )}
        </nav>
      </aside>

      {/* ══ Chat Area ════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <div className="px-4 py-3 brutal-border-b bg-white flex items-center gap-3 shrink-0">
          <button className="md:hidden w-8 h-8 grid place-items-center border-2 border-brutal-ink hover:bg-brutal-yellow transition-colors rounded"
            onClick={() => setSidebarOpen(true)}>
            <ChevronLeft size={16} />
          </button>

          {activeChannel ? (
            <>
              {activeChannel.type === 'DIRECT' && activeChannel.otherMember
                ? <Avatar name={activeChannelLabel} size="lg" />
                : (
                  <div className="w-9 h-9 grid place-items-center border-2 border-brutal-ink bg-brutal-yellow rounded shrink-0">
                    {channelIcon(activeChannel.type)}
                  </div>
                )
              }
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[15px] tracking-tight truncate">{activeChannelLabel}</p>
                <p className="text-[11px] text-brutal-ink/50">
                  {activeChannel.type === 'DIRECT'
                    ? activeChannel.otherMember?.employeeCode ?? ''
                    : `${activeChannel.members.length} members`}
                </p>
              </div>

              {/* Connection dot + header three-dot menu */}
              <div className="flex items-center gap-2 shrink-0">
                <div className={`w-2.5 h-2.5 rounded-full border-2 border-white ${connected ? 'bg-green-500' : 'bg-brutal-red animate-pulse'}`} />

                {/* Header ⋯ — not shown for GENERAL */}
                {activeChannel.type !== 'GENERAL' && (
                  <div className="relative" ref={headerMenuRef}>
                    <button
                      onClick={() => setHeaderMenuOpen((v) => !v)}
                      className="w-8 h-8 grid place-items-center rounded-full hover:bg-gray-100 text-brutal-ink/50 hover:text-brutal-ink transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {headerMenuOpen && (
                      <div className="absolute right-0 top-9 z-30 w-52 bg-white brutal-border brutal-shadow py-1">
                        <button
                          onClick={handleDeleteConversation}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] hover:bg-red-50 text-brutal-red transition-colors text-left"
                        >
                          {activeChannel.type === 'DIRECT'
                            ? <><Trash2 size={14} className="shrink-0" /> Delete conversation</>
                            : <><LogOut size={14} className="shrink-0" /> Leave group</>
                          }
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-[13px] text-brutal-ink/40">Select a channel to start chatting</p>
          )}
        </div>

        {/* Messages */}
        <div ref={messagesBoxRef} className="flex-1 overflow-y-auto px-4 py-4 min-h-0 bg-[#f0f2f5]">
          {activeChannelId ? (
            <div className="flex flex-col gap-1">

              {hasMore && (
                <div className="flex justify-center py-2">
                  <button onClick={handleLoadMore} disabled={loadingMore}
                    className="px-4 py-1.5 text-[12px] font-semibold bg-white brutal-border brutal-shadow-sm hover:bg-brutal-yellow transition-colors flex items-center gap-2 disabled:opacity-50">
                    {loadingMore && <Loader2 size={12} className="animate-spin" />} Load earlier messages
                  </button>
                </div>
              )}

              {messages.length === 0 && !loadingMore && (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-brutal-ink/30">
                  <MessageSquare size={48} strokeWidth={1.5} />
                  <p className="text-[13px] font-semibold">No messages yet — say something!</p>
                </div>
              )}

              {messages.map((msg, i) => {
                const isMine = msg.author.id === myId;
                const prevMsg = messages[i - 1];
                const showAvatar = !prevMsg || prevMsg.author.id !== msg.author.id;
                const spacingClass = showAvatar && i > 0 ? 'mt-3' : 'mt-0.5';
                return (
                  <div key={msg.id} className={spacingClass}>
                    <MessageBubble
                      msg={msg}
                      isMine={isMine}
                      showAvatar={showAvatar}
                      selected={selectedIds.has(msg.id)}
                      selectMode={selectMode}
                      onDelete={handleDeleteSingle}
                      onSelect={handleSelect}
                    />
                  </div>
                );
              })}

              {/* Typing indicator */}
              {typingUsers.size > 0 && (
                <div className="flex items-center gap-2 mt-3 pl-10">
                  <div className="flex gap-1 bg-white px-3 py-2 rounded-full border border-gray-200 shadow-sm">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="w-2 h-2 bg-brutal-ink/40 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-brutal-ink/20">
              <MessageSquare size={56} strokeWidth={1} />
              <p className="text-[14px] font-semibold">Select a channel to start chatting</p>
            </div>
          )}
        </div>

        {/* ── Multi-select floating action bar ──────────────────────────────── */}
        {selectMode && (
          <div className="px-4 py-3 bg-brutal-ink text-white flex items-center justify-between shrink-0 border-t-2 border-brutal-ink">
            <span className="text-[13px] font-semibold">
              {selectedIds.size} selected
              {selectedMineCount < selectedIds.size && selectedIds.size > 0 && (
                <span className="text-white/60 text-[11px] ml-1">(only yours can be deleted)</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {selectedMineCount > 0 && (
                <button
                  onClick={() => setConfirm({ msg: `Delete ${selectedMineCount} message${selectedMineCount > 1 ? 's' : ''}? This cannot be undone.`, action: () => { handleBulkDelete(); setConfirm(null); } })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brutal-red text-white text-[12px] font-bold border-2 border-brutal-red hover:bg-red-700 transition-colors rounded"
                >
                  <Trash2 size={12} />
                  Delete {selectedMineCount > 1 ? `${selectedMineCount} messages` : 'message'}
                </button>
              )}
              <button
                onClick={exitSelectMode}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white text-[12px] font-bold border-2 border-white/30 hover:bg-white/20 transition-colors rounded"
              >
                <X size={12} />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Input — hidden in select mode */}
        {activeChannelId && !selectMode && (
          <div className="px-4 py-3 border-t border-gray-200 bg-white shrink-0">
            <div className="flex items-end gap-2 bg-[#f0f2f5] rounded-2xl px-4 py-2 border-2 border-brutal-ink">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message…"
                rows={1}
                className="flex-1 bg-transparent focus:outline-none text-[14px] resize-none leading-relaxed placeholder:text-brutal-ink/40 min-h-[28px] max-h-[120px] overflow-y-auto py-1"
              />
              <button onClick={handleSend} disabled={!input.trim() || !connected}
                className="w-9 h-9 grid place-items-center bg-[#2563EB] text-white rounded-full hover:bg-brutal-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                <Send size={15} />
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-brutal-red animate-pulse'}`} />
              <span className="text-[10px] text-brutal-ink/40">{connected ? 'Connected' : 'Reconnecting…'}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── DM Modal ──────────────────────────────────────────────────────────── */}
      {showDM && (
        <NewDMModal
          onClose={() => setShowDM(false)}
          onCreated={(ch) => {
            setShowDM(false);
            queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
            handleChannelSelect(ch.id);
          }}
        />
      )}

      {/* ── Confirm Dialog ────────────────────────────────────────────────────── */}
      {confirm && (
        <ConfirmDialog
          message={confirm.msg}
          onConfirm={confirm.action}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
