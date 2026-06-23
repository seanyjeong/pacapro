'use client';

import { useState } from 'react';
import { ExternalLink, Link2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { jungsiAPI, type JungsiStatus } from '@/lib/api/jungsi';

interface Props {
  status: JungsiStatus | null;
  onRefresh: () => Promise<void> | void;
  compact?: boolean;
}

function getButtonText(status: JungsiStatus | null) {
  if (!status?.isConfigured) return '정시엔진 연동';
  if (!status.jungsiApi.healthy) return '연동 다시 확인';
  return '정시엔진 재연동';
}

export function JungsiLinkButton({ status, onRefresh, compact = false }: Props) {
  const [linking, setLinking] = useState(false);

  const startLink = async () => {
    setLinking(true);
    try {
      const response = await jungsiAPI.startLink();
      window.open(response.loginUrl, '_blank', 'noopener,noreferrer');
      toast.success('정시엔진 로그인 창을 열었습니다. 로그인 완료 후 상태를 다시 확인해주세요.');
      await onRefresh();
    } catch {
      toast.error('정시엔진 연동을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className={`flex ${compact ? 'items-center gap-2' : 'flex-wrap items-center justify-center gap-2'}`}>
      <Button type="button" onClick={startLink} disabled={linking} size={compact ? 'sm' : 'default'}>
        {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
        {getButtonText(status)}
        {!linking && <ExternalLink className="ml-2 h-3.5 w-3.5" />}
      </Button>
      {status?.isConfigured && (
        <Button type="button" variant="outline" size={compact ? 'sm' : 'default'} onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          상태 확인
        </Button>
      )}
    </div>
  );
}
