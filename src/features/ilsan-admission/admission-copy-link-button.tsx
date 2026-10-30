'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { admissionError, admissionsAPI } from '@/lib/api/ilsan-admissions';

export function AdmissionCopyLinkButton() {
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualLink, setManualLink] = useState('');
  const [copied, setCopied] = useState(false);
  const actionLock = useRef(false);

  useEffect(() => {
    let active = true;
    // Reuse the server's academy and student-edit permission checks, not local user claims.
    admissionsAPI.shareLink().then(() => {
      if (active) setAllowed(true);
    }).catch(() => {
      if (active) setAllowed(false);
    });
    return () => { active = false; };
  }, []);

  async function copyLink() {
    if (!allowed || actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setCopied(false);
    setManualLink('');
    try {
      // Recheck before copying in case the account's academy or permissions changed.
      const { path } = await admissionsAPI.shareLink();
      const link = new URL(path, window.location.origin).href;
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      } catch {
        // Clipboard permissions and browser user-activation policies can reject a write.
        setManualLink(link);
      }
    } catch (error) {
      setAllowed(false);
      toast.error(admissionError(error));
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  if (!allowed) return null;

  return <div className="min-w-0 max-w-full space-y-2">
    <Button type="button" variant="outline" className="gap-2" disabled={busy} onClick={() => void copyLink()}>
      <Copy className="h-4 w-4" aria-hidden="true" />입학원서 링크 복사
    </Button>
    {copied && <p role="status" className="text-sm text-muted-foreground">입학원서 링크를 복사했습니다.</p>}
    {manualLink && <div className="space-y-1">
      <p role="status" className="text-sm text-muted-foreground">자동 복사가 허용되지 않았습니다. 아래 링크를 선택해 복사해 주세요.</p>
      <input aria-label="복사할 입학원서 링크" readOnly value={manualLink} autoFocus
        onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()}
        className="w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </div>}
  </div>;
}
