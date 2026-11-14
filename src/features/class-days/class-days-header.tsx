import Link from 'next/link';
import { UserPlus, Users } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface ClassDaysHeaderProps {
  description?: string;
  showLinks?: boolean;
}

export function ClassDaysHeader({ description, showLinks = false }: ClassDaysHeaderProps) {
  return (
    <PageHeader
      title="수업일 관리"
      description={description || '재원생의 수업 요일과 시간대를 바꿔요.'}
      actions={showLinks ? (
        <>
          <Link className={buttonVariants({ variant: 'outline' })} href="/students">
            <Users className="h-4 w-4" />
            학생 목록
          </Link>
          <Link className={buttonVariants({ variant: 'outline' })} href="/students/new">
            <UserPlus className="h-4 w-4" />
            학생 등록
          </Link>
        </>
      ) : undefined}
    />
  );
}
