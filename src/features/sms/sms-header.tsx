import { MessageSquare, RadioTower, Send } from 'lucide-react';
import { HeaderMetric } from './sms-header-metric';
import type { MessageType } from './sms-types';

interface SmsHeaderProps {
  messageType: MessageType;
  recipientCount: number;
  senderCount: number;
}

export function SmsHeader({ messageType, recipientCount, senderCount }: SmsHeaderProps) {
  return (
    <header className="grid gap-4 border-b border-border/70 pb-5 lg:grid-cols-12 lg:items-end">
      <div className="flex items-start gap-3 lg:col-span-8">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Messaging Desk</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">문자 보내기</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            수신자, 발신번호, 이미지 첨부 상태를 확인한 뒤 발송합니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 lg:col-span-4">
        <HeaderMetric icon={<Send className="h-4 w-4" />} label="유형" value={messageType} />
        <HeaderMetric icon={<MessageSquare className="h-4 w-4" />} label="대상" value={`${recipientCount}명`} />
        <HeaderMetric icon={<RadioTower className="h-4 w-4" />} label="발신" value={`${senderCount}개`} />
      </div>
    </header>
  );
}
