'use client';

import { RefreshCw, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';

interface Props {
  canAddStaff: boolean;
  loading: boolean;
  onAddStaff: () => void;
  onRefresh: () => void;
}

export function StaffPageHeader({ canAddStaff, loading, onAddStaff, onRefresh }: Props) {
  return (
    <PageHeader
      title="직원 관리"
      description="강사 계정과 화면별 권한을 한 곳에서 관리해요."
      actions={(
        <>
          <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading} title="새로고침" aria-label="새로고침">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={onAddStaff} disabled={!canAddStaff}>
            <UserPlus className="h-4 w-4" />
            권한 부여
          </Button>
        </>
      )}
    />
  );
}
