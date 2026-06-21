'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import type { ChecklistItem } from '@/lib/types/consultation';

type DraftAutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface UseConsultationDraftAutosaveParams {
  consultationId?: number;
  enabled: boolean;
  checklist: ChecklistItem[];
  consultationMemo: string;
  delayMs?: number;
}

interface DraftPayload {
  checklist: ChecklistItem[];
  consultationMemo: string;
}

function createSnapshot(payload: DraftPayload) {
  return JSON.stringify(payload);
}

export function useConsultationDraftAutosave({
  consultationId,
  enabled,
  checklist,
  consultationMemo,
  delayMs = 1200,
}: UseConsultationDraftAutosaveParams) {
  const [autosaveStatus, setAutosaveStatus] = useState<DraftAutosaveStatus>('idle');
  const latestSnapshotRef = useRef('');
  const lastSavedSnapshotRef = useRef('');
  const activeConsultationIdRef = useRef<number | undefined>();
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const statusRef = useRef<DraftAutosaveStatus>('idle');
  const lastErrorToastAtRef = useRef(0);

  const snapshot = useMemo(
    () => createSnapshot({ checklist, consultationMemo }),
    [checklist, consultationMemo],
  );

  useEffect(() => {
    statusRef.current = autosaveStatus;
  }, [autosaveStatus]);

  useEffect(() => {
    if (!enabled || !consultationId) {
      activeConsultationIdRef.current = undefined;
      latestSnapshotRef.current = '';
      lastSavedSnapshotRef.current = '';
      setAutosaveStatus('idle');
      return;
    }

    latestSnapshotRef.current = snapshot;

    if (activeConsultationIdRef.current !== consultationId) {
      activeConsultationIdRef.current = consultationId;
      lastSavedSnapshotRef.current = snapshot;
      setAutosaveStatus('saved');
      return;
    }

    if (snapshot !== lastSavedSnapshotRef.current) {
      setAutosaveStatus('dirty');
    } else {
      setAutosaveStatus(prev => (prev === 'saving' ? prev : 'saved'));
    }
  }, [consultationId, enabled, snapshot]);

  const saveDraftNow = useCallback(async (): Promise<boolean> => {
    if (!enabled || !consultationId) {
      return true;
    }

    if (savePromiseRef.current) {
      const currentSaveSucceeded = await savePromiseRef.current;
      if (!currentSaveSucceeded) {
        return false;
      }
    }

    const targetSnapshot = latestSnapshotRef.current;
    if (!targetSnapshot || targetSnapshot === lastSavedSnapshotRef.current) {
      return true;
    }

    setAutosaveStatus('saving');
    const payload = JSON.parse(targetSnapshot) as DraftPayload;

    const savePromise = apiClient
      .put<void>(`/consultations/${consultationId}`, payload)
      .then(() => {
        lastSavedSnapshotRef.current = targetSnapshot;
        setAutosaveStatus(latestSnapshotRef.current === targetSnapshot ? 'saved' : 'dirty');
        return true;
      })
      .catch(() => {
        setAutosaveStatus('error');
        const now = Date.now();
        if (now - lastErrorToastAtRef.current > 5000) {
          lastErrorToastAtRef.current = now;
          toast.error('입력 내용을 자동 저장하지 못했습니다. 저장 버튼을 눌러 다시 시도해주세요.');
        }
        return false;
      })
      .finally(() => {
        savePromiseRef.current = null;
      });

    savePromiseRef.current = savePromise;
    return savePromise;
  }, [consultationId, enabled]);

  useEffect(() => {
    if (autosaveStatus !== 'dirty') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveDraftNow();
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [autosaveStatus, delayMs, saveDraftNow, snapshot]);

  useEffect(() => {
    return () => {
      if (enabled && latestSnapshotRef.current !== lastSavedSnapshotRef.current) {
        void saveDraftNow();
      }
    };
  }, [enabled, saveDraftNow]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!enabled || !['dirty', 'saving', 'error'].includes(statusRef.current)) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled]);

  return {
    autosaveStatus,
    saveDraftNow,
  };
}
