'use client';

import { useEffect, useRef } from 'react';
import { PACA_API_BASE_URL } from '@/lib/api/base-url';

interface AttendanceRealtimeOptions {
  scheduleId?: number | null;
  enabled?: boolean;
  onAttendanceUpdated: () => void;
}

function getRealtimeUrl() {
  const base = new URL(PACA_API_BASE_URL);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = '/paca/realtime/attendance';
  base.search = '';
  return base.toString();
}

export function useAttendanceRealtime({
  scheduleId,
  enabled = true,
  onAttendanceUpdated,
}: AttendanceRealtimeOptions) {
  const callbackRef = useRef(onAttendanceUpdated);

  useEffect(() => {
    callbackRef.current = onAttendanceUpdated;
  }, [onAttendanceUpdated]);

  useEffect(() => {
    if (!enabled || !scheduleId || typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    if (!token) return;

    let closed = false;
    let reconnects = 0;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      socket = new WebSocket(getRealtimeUrl());

      socket.addEventListener('open', () => {
        reconnects = 0;
        socket?.send(JSON.stringify({ type: 'auth', token }));
      });

      socket.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type !== 'attendance-updated') return;
          if (Number(payload.schedule_id) !== Number(scheduleId)) return;
          callbackRef.current();
        } catch {
          // Ignore malformed realtime payloads; the next manual refresh remains available.
        }
      });

      socket.addEventListener('close', () => {
        if (closed || reconnects >= 3) return;
        reconnects += 1;
        reconnectTimer = setTimeout(connect, 1000 * reconnects);
      });
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [enabled, scheduleId]);
}
