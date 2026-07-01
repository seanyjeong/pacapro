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

type JungsiLinkMessage = {
  source?: string;
  status?: 'success' | 'error';
  state?: string;
  message?: string;
  branchName?: string;
};

const JUNGSI_LINK_SOURCE = 'paca-jungsi-link';
const JUNGSI_LINK_TIMEOUT_MS = 10 * 60 * 1000;
const JUNGSI_LINK_POPUP_FEATURES = [
  'popup=yes',
  'width=520',
  'height=720',
  'left=120',
  'top=80',
  'menubar=no',
  'toolbar=no',
  'location=yes',
  'status=no',
  'resizable=yes',
  'scrollbars=yes',
].join(',');

function getButtonText(status: JungsiStatus | null) {
  if (!status?.isConfigured) return '정시엔진 연동';
  if (!status.jungsiApi.healthy) return '연동 다시 확인';
  return '정시엔진 재연동';
}

function getOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function getLinkState(url: string) {
  try {
    return new URL(url).searchParams.get('paca_link_state');
  } catch {
    return null;
  }
}

function waitForJungsiLink(loginOrigin: string | null, expectedState: string | null, popup: Window) {
  return new Promise<JungsiLinkMessage>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      window.clearInterval(closedTimer);
      window.clearTimeout(timeoutTimer);
    };

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const handleMessage = (event: MessageEvent<JungsiLinkMessage>) => {
      if (loginOrigin && event.origin !== loginOrigin) return;
      if (event.data?.source !== JUNGSI_LINK_SOURCE) return;
      if (expectedState && event.data.state !== expectedState) return;

      if (event.data.status === 'success') {
        settle(() => resolve(event.data));
        return;
      }

      settle(() => reject(new Error(event.data?.message || '정시엔진 연동을 완료하지 못했습니다.')));
    };

    const closedTimer = window.setInterval(() => {
      if (popup.closed) {
        settle(() => reject(new Error('정시엔진 로그인 창이 닫혔습니다. 다시 연동해주세요.')));
      }
    }, 1000);

    const timeoutTimer = window.setTimeout(() => {
      settle(() => reject(new Error('정시엔진 연동 시간이 만료되었습니다. 다시 시도해주세요.')));
    }, JUNGSI_LINK_TIMEOUT_MS);

    window.addEventListener('message', handleMessage);
  });
}

export function JungsiLinkButton({ status, onRefresh, compact = false }: Props) {
  const [linking, setLinking] = useState(false);

  const startLink = async () => {
    setLinking(true);
    try {
      const response = await jungsiAPI.startLink();
      const popup = window.open(response.loginUrl, 'paca-jungsi-link', JUNGSI_LINK_POPUP_FEATURES);
      if (!popup) {
        toast.error('로그인 창이 차단되었습니다. 팝업 차단을 해제한 뒤 다시 시도해주세요.');
        return;
      }

      toast.info('정시엔진 로그인 창에서 로그인하면 자동으로 연동됩니다.');
      const result = await waitForJungsiLink(
        getOrigin(response.loginUrl),
        getLinkState(response.loginUrl),
        popup
      );
      await onRefresh();
      toast.success(result.message || '정시엔진이 정상적으로 연동되었습니다.');
    } catch (error) {
      const message = error instanceof Error ? error.message : '정시엔진 연동을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.';
      toast.error(message);
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
