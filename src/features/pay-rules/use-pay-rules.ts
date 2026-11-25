'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { deletePayRule, fetchPayRules } from './pay-rule-api';
import type { PayRule } from './pay-rule-types';
import { apiErrorMessage } from './pay-rule-utils';

export function usePayRules({ instructorId, seasonId }: { instructorId?: number; seasonId?: number }) {
  const [rules, setRules] = useState<PayRule[]>([]);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<PayRule | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<PayRule | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setRules(await fetchPayRules({ instructorId, seasonId }));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [instructorId, seasonId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const close = () => {
    setAdding(false);
    setEditing(null);
  };

  const saved = () => {
    close();
    void reload();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deletePayRule(deleting.id);
      toast.success('급여 규칙을 삭제했습니다.');
      setDeleting(null);
      await reload();
    } catch (error) {
      toast.error(apiErrorMessage(error, '급여 규칙을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setBusy(false);
    }
  };

  return { rules, failed, reload, editing, setEditing, adding, setAdding, deleting, setDeleting, busy, close, saved, confirmDelete };
}
