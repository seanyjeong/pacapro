'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import apiClient from '@/lib/api/client';
import { SettingsSectionCard } from '@/features/settings/settings-section-card';

type Service = 'calendar' | 'drive' | 'sheets';
interface GoogleStatus {
  configured: boolean;
  worker_enabled: boolean;
  connected: boolean;
  email: string | null;
  last_error: string | null;
  last_synced_at: string | null;
  services: Record<Service, { enabled: boolean; granted: boolean; implemented: boolean }>;
}
const services: { key: Service; label: string; description: string }[] = [
  { key: 'calendar', label: '캘린더', description: '모든 상담과 학원 일정을 ‘파카 일정’ 캘린더에 자동 반영합니다.' },
  { key: 'drive', label: '드라이브', description: '권한과 사용 설정만 저장합니다. 파일 연동 기능은 준비 중입니다.' },
  { key: 'sheets', label: '스프레드시트', description: '권한과 사용 설정만 저장합니다. 시트 연동 기능은 준비 중입니다.' },
];
const endpoint = '/google-integration';

export function GoogleIntegrationCard() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    try { setStatus(await apiClient.get<GoogleStatus>(endpoint, { suppressErrorToast: true })); setError(''); }
    catch { setError('구글 연동 상태를 불러오지 못했습니다. 다시 시도해 주세요.'); }
  }, []);
  useEffect(() => {
    void refresh();
    const url = new URL(window.location.href);
    const result = url.searchParams.get('google');
    if (result) {
      setNotice(result === 'connected' ? '구글 계정을 연결했습니다. 사용할 서비스를 켜 주세요.' : '구글 연결을 완료하지 못했습니다. 권한을 확인하고 다시 연결해 주세요.');
      url.searchParams.delete('google');
      window.history.replaceState(null, '', url.toString());
    }
  }, [refresh]);
  async function act(work: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); }
    catch { setError('설정을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }
  const connect = () => act(async () => {
    const { url } = await apiClient.post<{ url: string }>(`${endpoint}/authorize`, {}, { suppressErrorToast: true });
    window.location.assign(url);
  });
  const toggle = (service: Service, enabled: boolean) => act(async () => {
    setStatus(await apiClient.put<GoogleStatus>(`${endpoint}/services/${service}`, { enabled }, { suppressErrorToast: true }));
    setNotice('연동 설정을 저장했습니다.');
  });
  const disconnect = () => act(async () => {
    setStatus(await apiClient.delete<GoogleStatus>(endpoint, { suppressErrorToast: true }));
    setNotice('파카에서 구글 연결을 해제했습니다. 기존 구글 일정은 유지됩니다.');
  });
  return (
    <SettingsSectionCard id="google-integration" title="구글 연동하기" icon={Link2}
      description="교육원에서 사용할 구글 계정을 연결하고 서비스별로 사용 여부를 설정합니다.">
      {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm text-destructive">
        <p>{error}</p><Button variant="outline" size="sm" disabled={busy} onClick={() => void refresh()}>다시 불러오기</Button>
      </div>}
      {notice && <p role="status" className="mb-4 text-sm text-foreground">{notice}</p>}
      {!status && !error && <p role="status" className="text-sm text-muted-foreground">구글 연동 상태를 불러오는 중입니다.</p>}
      {status && <>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{status.connected ? '연결됨' : '연결된 구글 계정 없음'}</p>
            {status.connected && <p className="mt-1 break-all text-sm text-muted-foreground">{status.email}</p>}
            {!status.configured && <p className="mt-1 text-sm text-muted-foreground">구글 연결 준비 중입니다. 관리자에게 문의해 주세요.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !status.configured} onClick={connect}>
              {busy ? '처리 중…' : status.connected ? '구글 계정 다시 연결' : '구글 계정 연결'}
            </Button>
            {status.connected && <Button variant="outline" disabled={busy} onClick={disconnect}>연결 해제</Button>}
          </div>
        </div>
        <div className="divide-y divide-border/60">
          {services.map(({ key, label, description }) => <div key={key} className="flex items-start justify-between gap-4 py-4">
            <div className="min-w-0">
              <label htmlFor={`google-${key}`} className="text-sm font-medium">{label}</label>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
              {status.connected && !status.services[key].granted && <p className="mt-1 text-sm text-muted-foreground">다시 연결하여 권한을 허용해 주세요.</p>}
            </div>
            <Switch id={`google-${key}`} checked={status.services[key].enabled}
              disabled={busy || !status.connected || !status.services[key].granted}
              onCheckedChange={(enabled) => void toggle(key, enabled)} />
          </div>)}
        </div>
        <div className="space-y-2 border-t border-border/60 pt-4 text-sm leading-6 text-muted-foreground">
          <p>연동을 끄거나 연결을 해제해도 기존 구글 일정은 유지됩니다. 다시 켜면 최신 파카 일정으로 반영합니다.</p>
          <p className="flex flex-wrap gap-x-4">
            <a href="/google-integration/privacy.html" target="_blank" rel="noreferrer" className="underline underline-offset-4">개인정보처리방침</a>
            <a href="/google-integration/terms.html" target="_blank" rel="noreferrer" className="underline underline-offset-4">이용약관</a>
          </p>
          {status.services.calendar.enabled && !status.worker_enabled && <p role="status">자동 동기화 시작을 기다리고 있습니다. 관리자에게 문의해 주세요.</p>}
          {status.last_error && <p role="status">{status.last_error === 'RECONNECT_REQUIRED' ? '구글 연결이 만료되었습니다. 계정을 다시 연결해 주세요.' : '일부 일정을 반영하지 못해 자동으로 다시 시도하고 있습니다.'}</p>}
          {status.last_synced_at && <p>최근 일정 반영: {status.last_synced_at}</p>}
        </div>
      </>}
    </SettingsSectionCard>
  );
}
