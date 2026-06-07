'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace('/api/v1', '');

export interface LiveNotification {
  notification: {
    id: string;
    type: string;
    title: string;
    body: string;
    referenceId?: string | null;
    referenceType?: string | null;
    createdAt: string;
  };
  event?: Record<string, unknown>;
}

/**
 * Connects to the /notifications Socket.IO namespace (JWT-authed) and
 * surfaces live pushes — e.g. "calendar:assigned" when a manager assigns
 * the current employee to a company visit.
 */
export function useNotifications() {
  const accessToken = useAuthStore(s => s.accessToken);
  const employeeId = useAuthStore(s => s.user?.id);
  const socketRef = useRef<Socket | null>(null);
  const [latest, setLatest] = useState<LiveNotification | null>(null);

  useEffect(() => {
    if (!accessToken || !employeeId) return;

    const socket = io(`${SOCKET_URL}/notifications`, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('calendar:assigned', (payload: LiveNotification) => {
      setLatest(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, employeeId]);

  const dismiss = () => setLatest(null);

  return { latest, dismiss };
}
