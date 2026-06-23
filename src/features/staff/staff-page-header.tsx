'use client';

import { RefreshCw, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  canAddStaff: boolean;
  loading: boolean;
  onAddStaff: () => void;
  onRefresh: () => void;
}

export function StaffPageHeader({ canAddStaff, loading, onAddStaff, onRefresh }: Props) {
  return (
    <header className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Access Control</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">직원 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">강사 계정과 화면별 권한을 한 곳에서 관리합니다.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button variant="outline" onClick={onRefresh} disabled={loading} className="justify-center rounded-md">
          <RefreshCw className="mr-2 h-4 w-4" />
          새로고침
        </Button>
        <Button onClick={onAddStaff} disabled={!canAddStaff} className="justify-center rounded-md">
          <UserPlus className="mr-2 h-4 w-4" />
          권한 부여
        </Button>
      </div>
    </header>
  );
}
