import { LogOut, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TABLET_APP_VERSION } from './tablet-settings-utils';

interface TabletSettingsSystemCardProps {
  loggingOut: boolean;
  onLogout: () => void;
}

export function TabletSettingsSystemCard({ loggingOut, onLogout }: TabletSettingsSystemCardProps) {
  return (
    <section className="rounded-2xl bg-card p-5" aria-label="앱 정보">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Shield className="h-[18px] w-[18px]" />
        </span>
        <h2 className="text-[17px] font-bold text-foreground">앱 정보</h2>
      </div>
      <dl className="mt-3 divide-y divide-border/60 text-sm">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-muted-foreground">버전</dt>
          <dd className="font-semibold text-foreground">P-ACA 태블릿 {TABLET_APP_VERSION}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-muted-foreground">기기 상태</dt>
          <dd className="font-semibold text-foreground">로그인됨</dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-muted-foreground">문의</dt>
          <dd className="font-semibold text-foreground tabular-nums">010-2144-6755</dd>
        </div>
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" />
          앱 새로고침
        </Button>
        <Button type="button" variant="destructive" onClick={onLogout} disabled={loggingOut}>
          <LogOut className="h-4 w-4" />
          {loggingOut ? '로그아웃 중...' : '로그아웃'}
        </Button>
      </div>
    </section>
  );
}
