'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace('/api/v1', '');

export interface AttendanceUpdatedEvent {
  date: string;
  status: string;
  punchInTime: string | null;
  punchOutTime: string | null;
}

/**
 * Connects to the /notifications Socket.IO namespace (JWT-authed, joins the
 * employee-scoped room server-side) and invokes `onUpdate` whenever the
 * backend pushes an 'attendance:updated' event for the current employee —
 * covers self punch-in/out as well as admin-side regularize/edit/upsert.
 */
export function useAttendanceLive(onUpdate: (event: AttendanceUpdatedEvent) => void) {
  const accessToken = useAuthStore(s => s.accessToken);
  const employeeId = useAuthStore(s => s.user?.id);
  const socketRef = useRef<Socket | null>(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => { onUpdateRef.current = onUpdate; });

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

    socket.on('attendance:updated', (payload: AttendanceUpdatedEvent) => {
      onUpdateRef.current(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, employeeId]);
}
