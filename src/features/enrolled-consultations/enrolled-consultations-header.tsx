import Link from 'next/link';
import { Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EnrolledConsultationsHeaderProps {
  onCreate: () => void;
}

export function EnrolledConsultationsHeader({ onCreate }: EnrolledConsultationsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">재원생상담</h1>
        <p className="text-muted-foreground">재원생 학습/진학 상담 관리</p>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/consultations/calendar?type=learning">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            캘린더
          </Button>
        </Link>
        <Button onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          재원생상담 등록
        </Button>
      </div>
    </div>
  );
}
