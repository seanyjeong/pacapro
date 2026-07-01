'use client';

import { useState } from 'react';
import { ExternalLink, Link2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { startJungsiLink } from './performance-api';
import type { JungsiStatus } from './performance-types';

interface PerformanceJungsiLinkButtonProps {
  status: JungsiStatus | null;
  onRefresh: () => Promise<void> | void;
}

function getButtonText(status: JungsiStatus | null) {
  if (!status?.isConfigured) return '정시엔진 연동';
  if (!status.jungsiApi.healthy) return '연동 다시 확인';
  return '정시엔진 재연동';
}

export function PerformanceJungsiLinkButton({ status, onRefresh }: PerformanceJungsiLinkButtonProps) {
  const [open, setOpen] = useState(false);
  const [linking, setLinking] = useState(false);

  const handleStartLink = async () => {
    const popup = window.open('', '_blank', 'popup,width=1080,height=760');
    if (!popup) {
      toast.error('팝업이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도해주세요.');
      return;
    }

    popup.opener = null;
    setLinking(true);
    try {
      const response = await startJungsiLink();
      popup.location.href = response.loginUrl;
      setOpen(false);
      toast.success('정시엔진 로그인 창을 열었습니다. 로그인 완료 후 상태를 다시 확인해주세요.');
      await onRefresh();
    } catch {
      popup.close();
      toast.error('정시엔진 연동을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLinking(false);
    }
  };

  return (
    <>
      <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3">
        <Button className="gap-2" type="button" onClick={() => setOpen(true)} disabled={linking}>
          {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {getButtonText(status)}
        </Button>
        {status?.isConfigured && (
          <Button className="gap-2" type="button" variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
            연동 상태 새로고침
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-md">
          <DialogHeader>
            <DialogTitle>정시엔진 계정으로 연동</DialogTitle>
            <DialogDescription>
              정시엔진 아이디와 비밀번호로 로그인하면 이 학원의 정시엔진 지점 정보가 PACA와 연결됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p>로그인 성공 후 PACA가 학생 이름과 학교를 기준으로 정시엔진 성적을 조회합니다.</p>
            <p>비밀번호는 PACA에 저장하지 않고, 정시엔진이 발급한 연동 토큰만 확인합니다.</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={linking}>
              취소
            </Button>
            <Button className="gap-2" type="button" onClick={handleStartLink} disabled={linking}>
              {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              정시엔진 로그인 열기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
