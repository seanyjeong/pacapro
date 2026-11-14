import Link from 'next/link';
import { Calendar, ClipboardList, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface EnrolledConsultationsHeaderProps {
  onCreate: () => void;
}

export function EnrolledConsultationsHeader({ onCreate }: EnrolledConsultationsHeaderProps) {
  return (
    <PageHeader
      title="재원생상담"
      description="재원생 상담 일정, 상태 변경, 정시엔진 성적을 한곳에서 봐요."
      actions={(
        <>
          <Link href="/consultations">
            <Button variant="outline">
              <ClipboardList className="h-4 w-4" />
              전체 상담 관리
            </Button>
          </Link>
          <Link href="/consultations/calendar?type=learning">
            <Button variant="outline">
              <Calendar className="h-4 w-4" />
              상담 달력
            </Button>
          </Link>
          <Link href="/consultations/settings">
            <Button variant="outline">
              <Settings className="h-4 w-4" />
              상담 설정
            </Button>
          </Link>
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4" />
            재원생상담 등록
          </Button>
        </>
      )}
    />
  );
}
