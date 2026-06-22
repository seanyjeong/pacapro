import Link from 'next/link';
import { Calendar, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EnrolledConsultationsHeaderProps {
  onCreate: () => void;
}

export function EnrolledConsultationsHeader({ onCreate }: EnrolledConsultationsHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Learning Desk</p>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">재원생상담</h1>
        <p className="text-sm text-muted-foreground">재원생 상담 일정, 상태 변경, 정시엔진 성적 확인을 한 화면에서 처리합니다.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <Link className="min-w-0" href="/consultations/settings">
          <Button className="w-full justify-center sm:w-auto" variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            상담 설정
          </Button>
        </Link>
        <Link className="min-w-0" href="/consultations/calendar?type=learning">
          <Button className="w-full justify-center sm:w-auto" variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            캘린더
          </Button>
        </Link>
        <Button className="col-span-2 w-full justify-center sm:col-span-1 sm:w-auto" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          재원생상담 등록
        </Button>
      </div>
    </header>
  );
}
