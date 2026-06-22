import Link from 'next/link';
import { ArrowLeft, ListFilter, MessageSquare, RadioTower, RefreshCw, Send } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { HeaderMetric } from './sms-header-metric';
import type { MessageType, SmsStudent } from './sms-types';

interface TabletSmsHeaderProps {
  messageType: MessageType;
  recipientCount: number;
  senderCount: number;
  selectedStudent: SmsStudent | null;
  onRefresh: () => void;
}

export function TabletSmsHeader({
  messageType,
  recipientCount,
  senderCount,
  selectedStudent,
  onRefresh,
}: TabletSmsHeaderProps) {
  const title = selectedStudent ? `${selectedStudent.name} 문자 보내기` : '문자 보내기';

  return (
    <header className="space-y-4 border-b border-border/70 pb-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedStudent ? '학생 상담 후속 문자를 바로 확인하고 발송합니다.' : '태블릿에서 대상 확인 후 바로 발송합니다.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedStudent ? (
            <>
              <Link
                href={`/tablet/students/${selectedStudent.id}`}
                className={buttonVariants({ variant: 'outline', className: 'h-11 gap-2' })}
              >
                <ArrowLeft className="h-4 w-4" />
                {selectedStudent.name} 학생 상세
              </Link>
              <Link href="/tablet/sms" className={buttonVariants({ variant: 'outline', className: 'h-11 gap-2' })}>
                <ListFilter className="h-4 w-4" />
                전체 문자
              </Link>
            </>
          ) : null}
          <Button type="button" variant="outline" onClick={onRefresh} className="h-11 gap-2">
            <RefreshCw className="h-4 w-4" />
            새로고침
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <HeaderMetric icon={<Send className="h-4 w-4" />} label="유형" value={messageType} />
        <HeaderMetric icon={<MessageSquare className="h-4 w-4" />} label="대상" value={`${recipientCount}명`} />
        <HeaderMetric icon={<RadioTower className="h-4 w-4" />} label="발신" value={`${senderCount}개`} />
      </div>
    </header>
  );
}
