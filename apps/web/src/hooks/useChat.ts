'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ChatMessage } from '@/types';

const CHAT_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace('/api/v1', '');

interface UseChatOptions {
  employeeId: string | undefined;
  channelId: string | null;
  onMessage: (msg: ChatMessage) => void;
  onTyping: (data: { employeeId: string; isTyping: boolean }) => void;
  onDeleted: (data: { messageId: string; channelId: string }) => void;
  onMessagesDeleted: (data: { channelId: string; messageIds: string[] }) => void;
  onConversationDeleted: (data: { channelId: string; action: 'deleted' | 'left' }) => void;
}

export function useChat({
  employeeId,
  channelId,
  onMessage,
  onTyping,
  onDeleted,
  onMessagesDeleted,
  onConversationDeleted,
}: UseChatOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const currentChannelRef = useRef<string | null>(null);

  // ── Keep callback refs fresh so socket listeners never have stale closures ──
  const onMessageRef           = useRef(onMessage);
  const onTypingRef            = useRef(onTyping);
  const onDeletedRef           = useRef(onDeleted);
  const onMessagesDeletedRef   = useRef(onMessagesDeleted);
  const onConversationDeletedRef = useRef(onConversationDeleted);

  useEffect(() => { onMessageRef.current             = onMessage; });
  useEffect(() => { onTypingRef.current              = onTyping; });
  useEffect(() => { onDeletedRef.current             = onDeleted; });
  useEffect(() => { onMessagesDeletedRef.current     = onMessagesDeleted; });
  useEffect(() => { onConversationDeletedRef.current = onConversationDeleted; });

  // ── Connect once when employeeId becomes available ──────────────────────────
  useEffect(() => {
    if (!employeeId) return;

    const socket = io(`${CHAT_URL}/chat`, {
      auth: { employeeId },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Re-join the current channel after reconnect
      if (currentChannelRef.current) {
        socket.emit('join-channel', { channelId: currentChannelRef.current });
      }
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('new-message',          (msg: ChatMessage) => onMessageRef.current(msg));
    socket.on('typing',               (data: { employeeId: string; isTyping: boolean }) => onTypingRef.current(data));
    socket.on('message-deleted',      (data: { messageId: string; channelId: string }) => onDeletedRef.current(data));
    socket.on('messages-deleted',     (data: { channelId: string; messageIds: string[] }) => onMessagesDeletedRef.current(data));
    socket.on('conversation-deleted', (data: { channelId: string; action: 'deleted' | 'left' }) => onConversationDeletedRef.current(data));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [employeeId]); // only re-create socket when the logged-in user changes

  // ── Join / leave channel room when channelId changes ────────────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (currentChannelRef.current && currentChannelRef.current !== channelId) {
      socket.emit('leave-channel', { channelId: currentChannelRef.current });
      currentChannelRef.current = null;
    }

    if (channelId && socket.connected) {
      socket.emit('join-channel', { channelId });
      currentChannelRef.current = channelId;
    } else if (channelId) {
      // Socket not yet connected — store it; the connect handler will join
      currentChannelRef.current = channelId;
    }
  }, [channelId, connected]); // `connected` triggers re-run after reconnect

  // ── Actions ─────────────────────────────────────────────────────────────────
  const sendMessage = useCallback((body: string) => {
    if (!socketRef.current?.connected || !channelId || !body.trim()) return;
    socketRef.current.emit('send-message', { channelId, body });
  }, [channelId]);

  const deleteMessage = useCallback((messageId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('delete-message', { messageId });
  }, []);

  const deleteMessages = useCallback((cid: string, messageIds: string[]) => {
    if (!socketRef.current?.connected || !messageIds.length) return;
    socketRef.current.emit('delete-messages', { channelId: cid, messageIds });
  }, []);

  const deleteConversation = useCallback((cid: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('delete-conversation', { channelId: cid });
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (!socketRef.current?.connected || !channelId) return;
    socketRef.current.emit('typing', { channelId, isTyping });
  }, [channelId]);

  const markRead = useCallback((cid: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('mark-read', { channelId: cid });
  }, []);

  return { connected, sendMessage, deleteMessage, deleteMessages, deleteConversation, sendTyping, markRead };
}
