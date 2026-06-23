import Link from 'next/link';
import { Calendar, Plus, Settings } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

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
        <Link className={cn(buttonVariants({ variant: 'outline' }), 'min-w-0 w-full justify-center gap-2 sm:w-auto')} href="/consultations/settings">
          <Settings className="h-4 w-4" />
          상담 설정
        </Link>
        <Link className={cn(buttonVariants({ variant: 'outline' }), 'min-w-0 w-full justify-center gap-2 sm:w-auto')} href="/consultations/calendar?type=learning">
          <Calendar className="h-4 w-4" />
          상담 달력
        </Link>
        <Button className="col-span-2 w-full justify-center sm:col-span-1 sm:w-auto" onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          재원생상담 등록
        </Button>
      </div>
    </header>
  );
}
