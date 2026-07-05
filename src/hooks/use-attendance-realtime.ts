'use client';

import { useEffect, useRef } from 'react';
import { PACA_API_BASE_URL } from '@/lib/api/base-url';
import type { TimeSlot } from '@/lib/types/schedule';

interface AttendanceRealtimeOptions {
  scheduleId?: number | null;
  enabled?: boolean;
  onAttendanceUpdated: () => void;
}

interface InstructorAttendanceRealtimeOptions {
  date?: string | null;
  timeSlot?: TimeSlot | null;
  enabled?: boolean;
  onInstructorAttendanceUpdated: () => void;
}

function getRealtimeUrl() {
  const base = new URL(PACA_API_BASE_URL);
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = '/paca/realtime/attendance';
  base.search = '';
  return base.toString();
}

function connectAttendanceSocket(onMessage: (payload: unknown) => void) {
  const token = localStorage.getItem('token');
  if (!token) return () => {};

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
        onMessage(JSON.parse(event.data));
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

    return connectAttendanceSocket((payload) => {
      if (!payload || typeof payload !== 'object') return;
      const data = payload as { type?: string; schedule_id?: number | string };
      if (data.type !== 'attendance-updated') return;
      if (Number(data.schedule_id) !== Number(scheduleId)) return;
      callbackRef.current();
    });
  }, [enabled, scheduleId]);
}

export function useInstructorAttendanceRealtime({
  date,
  timeSlot,
  enabled = true,
  onInstructorAttendanceUpdated,
}: InstructorAttendanceRealtimeOptions) {
  const callbackRef = useRef(onInstructorAttendanceUpdated);

  useEffect(() => {
    callbackRef.current = onInstructorAttendanceUpdated;
  }, [onInstructorAttendanceUpdated]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    return connectAttendanceSocket((payload) => {
      if (!payload || typeof payload !== 'object') return;
      const data = payload as {
        type?: string;
        class_date?: string;
        records?: Array<{ time_slot?: string }>;
      };
      if (data.type !== 'instructor-attendance-updated') return;
      if (date && data.class_date !== date) return;
      if (timeSlot && !data.records?.some((record) => record.time_slot === timeSlot)) return;
      callbackRef.current();
    });
  }, [date, enabled, timeSlot]);
}
