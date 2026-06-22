import { MessageSquare, RadioTower, RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeaderMetric } from './sms-header-metric';
import type { MessageType } from './sms-types';

interface TabletSmsHeaderProps {
  messageType: MessageType;
  recipientCount: number;
  senderCount: number;
  onRefresh: () => void;
}

export function TabletSmsHeader({ messageType, recipientCount, senderCount, onRefresh }: TabletSmsHeaderProps) {
  return (
    <header className="space-y-4 border-b border-border/70 pb-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">문자 보내기</h1>
            <p className="mt-1 text-sm text-muted-foreground">태블릿에서 대상 확인 후 바로 발송합니다.</p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={onRefresh} className="h-11 gap-2 self-start">
          <RefreshCw className="h-4 w-4" />
          새로고침
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <HeaderMetric icon={<Send className="h-4 w-4" />} label="유형" value={messageType} />
        <HeaderMetric icon={<MessageSquare className="h-4 w-4" />} label="대상" value={`${recipientCount}명`} />
        <HeaderMetric icon={<RadioTower className="h-4 w-4" />} label="발신" value={`${senderCount}개`} />
      </div>
    </header>
  );
}
