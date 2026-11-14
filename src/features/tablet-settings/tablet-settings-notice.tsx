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
    ? 'border-success/30 bg-success-soft text-success'
    : notice.tone === 'error'
      ? 'border-destructive/30 bg-destructive-soft text-destructive'
      : 'border-sky-200 bg-sky-50 text-sky-900';

  return (
    <div className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium', className)}>
      <Icon className="h-4 w-4 shrink-0" />
      {notice.message}
    </div>
  );
}
