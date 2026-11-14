import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TabletSettingsNotice as Notice } from './tablet-settings-types';

interface TabletSettingsNoticeProps {
  notice: Notice;
}

export function TabletSettingsNotice({ notice }: TabletSettingsNoticeProps) {
  if (!notice) return null;

  const Icon = notice.tone === 'success' ? CheckCircle2 : notice.tone === 'error' ? AlertCircle : Info;
  const className = notice.tone === 'success'
    ? 'bg-success-soft text-success'
    : notice.tone === 'error'
      ? 'bg-destructive-soft text-destructive'
      : 'bg-primary-soft text-primary';

  return (
    <div className={cn('flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold', className)}>
      <Icon className="h-4 w-4 shrink-0" />
      {notice.message}
    </div>
  );
}
