import { Banknote, Calendar, Clock, DollarSign, Home, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { AcademySettings } from './settings-types';
import { getSalaryPayDayLabel } from './settings-utils';

interface SettingsOperationPanelProps {
  settings: AcademySettings;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
}

const links = [
  { href: '#academy-basic', label: '학원 기본 바로가기', icon: Home },
  { href: '#class-times', label: '수업 시간 바로가기', icon: Clock },
  { href: '#tuition', label: '학원비 바로가기', icon: DollarSign },
  { href: '#season-fees', label: '시즌비 바로가기', icon: Calendar },
  { href: '#salary-settings', label: '급여 설정 바로가기', icon: Banknote },
];

export function SettingsOperationPanel({ settings, hasUnsavedChanges, isSaving }: SettingsOperationPanelProps) {
  const statusText = isSaving ? '저장 중' : hasUnsavedChanges ? '변경 사항 있음' : '저장됨';

  return (
    <nav
      aria-label="운영 설정 바로가기"
      className="rounded-lg border border-border/70 bg-card p-4 shadow-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">운영 설정 바로가기</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">지점 기준, 시간, 비용, 정산을 한곳에서 조정합니다.</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold',
            hasUnsavedChanges
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          )}
        >
          {statusText}
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-md border border-border/70 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/35 focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="text-xs text-muted-foreground">열기</span>
            </a>
          );
        })}
      </div>

      <dl className="mt-4 grid gap-2 border-t border-border/60 pt-4 text-xs">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">학원</dt>
          <dd className="flex min-w-0 items-center gap-1 font-medium text-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{settings.academy_name || '미설정'}</span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">수업 시간</dt>
          <dd className="font-medium text-foreground">{settings.morning_class_time}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">학원비 납부</dt>
          <dd className="font-medium text-foreground">매월 {settings.tuition_due_day}일</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">급여 지급</dt>
          <dd className="font-medium text-foreground">{getSalaryPayDayLabel(settings.salary_payment_day)}</dd>
        </div>
      </dl>
    </nav>
  );
}
