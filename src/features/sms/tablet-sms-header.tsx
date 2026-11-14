import Link from 'next/link';
import { ArrowLeft, ListFilter, MessageSquare, RadioTower, RefreshCw, Send } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { PageHeader, StatTile } from '@/components/ui/page';
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
    <>
      <PageHeader
        title={title}
        description={selectedStudent ? '학생 상담 후속 문자를 바로 확인하고 보내요.' : '태블릿에서 대상을 확인한 뒤 바로 보내요.'}
        actions={(
          <>
            {selectedStudent ? (
              <>
                <Link href={`/tablet/students/${selectedStudent.id}`} className={buttonVariants({ variant: 'outline' })}>
                  <ArrowLeft className="h-4 w-4" />
                  {selectedStudent.name} 학생 상세
                </Link>
                <Link href="/tablet/sms" className={buttonVariants({ variant: 'outline' })}>
                  <ListFilter className="h-4 w-4" />
                  전체 문자
                </Link>
              </>
            ) : null}
            <Button type="button" variant="outline" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
              새로고침
            </Button>
          </>
        )}
      />

      <section className="grid grid-cols-3 gap-3" aria-label="문자 요약">
        <StatTile icon={Send} label="유형" tone="primary" value={messageType} />
        <StatTile icon={MessageSquare} label="대상" tone="success" value={`${recipientCount}명`} />
        <StatTile icon={RadioTower} label="발신" value={`${senderCount}개`} />
      </section>
    </>
  );
}
