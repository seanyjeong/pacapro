import { LogOut, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TABLET_APP_VERSION } from './tablet-settings-utils';

interface TabletSettingsSystemCardProps {
  loggingOut: boolean;
  onLogout: () => void;
}

export function TabletSettingsSystemCard({ loggingOut, onLogout }: TabletSettingsSystemCardProps) {
  return (
    <section className="rounded-md border border-border bg-background p-4" aria-label="앱 정보">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">앱 정보</h2>
      </div>
      <dl className="mt-4 grid gap-2 text-sm md:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/20 px-3 py-3">
          <dt className="text-xs text-muted-foreground">버전</dt>
          <dd className="mt-1 font-semibold text-foreground">P-ACA Tablet {TABLET_APP_VERSION}</dd>
        </div>
        <div className="rounded-md border border-border bg-muted/20 px-3 py-3">
          <dt className="text-xs text-muted-foreground">기기 상태</dt>
          <dd className="mt-1 font-semibold text-foreground">로그인됨</dd>
        </div>
        <div className="rounded-md border border-border bg-muted/20 px-3 py-3">
          <dt className="text-xs text-muted-foreground">문의</dt>
          <dd className="mt-1 font-semibold text-foreground">010-2144-6755</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => window.location.reload()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          앱 새로고침
        </Button>
        <Button type="button" variant="destructive" onClick={onLogout} disabled={loggingOut} className="gap-2">
          <LogOut className="h-4 w-4" />
          {loggingOut ? '로그아웃 중...' : '로그아웃'}
        </Button>
      </div>
    </section>
  );
}
