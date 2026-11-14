import Link from 'next/link';
import { ArrowLeft, List, Settings, UserCheck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface ConsultationCalendarHeaderProps {
  fromSchedule: boolean;
  onBack: () => void;
  onCreateLearningToday: () => void;
}

export function ConsultationCalendarHeader({
  fromSchedule,
  onBack,
  onCreateLearningToday,
}: ConsultationCalendarHeaderProps) {
  return (
    <PageHeader
      title="상담 달력"
      description="신규·재원생 상담과 상담 메모를 날짜별로 봐요."
      actions={(
        <>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            {fromSchedule ? '수업 스케줄로' : '목록으로'}
          </Button>
          {/* 수업 스케줄에서 들어왔을 때만 따로 보인다. 아니면 '목록으로'가 같은 상담 목록으로 간다. */}
          {fromSchedule && (
            <Link href="/consultations">
              <Button variant="outline">
                <List className="h-4 w-4" />
                상담 목록
              </Button>
            </Link>
          )}
          <Link href="/consultations/new-inquiry">
            <Button variant="outline">
              <UserPlus className="h-4 w-4" />
              신규상담 등록
            </Button>
          </Link>
          <Link href="/consultations/settings">
            <Button variant="outline" size="icon" aria-label="상담 시간 설정" title="상담 시간 설정">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <Button onClick={onCreateLearningToday}>
            <UserCheck className="h-4 w-4" />
            오늘 재원생 상담
          </Button>
        </>
      )}
    />
  );
}
