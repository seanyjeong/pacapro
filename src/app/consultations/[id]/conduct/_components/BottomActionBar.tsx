'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, ArrowLeft, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Consultation } from '@/lib/types/consultation';
import type { LinkedStudent } from '../_types';

interface BottomActionBarProps {
  consultation: Consultation;
  linkedStudent: LinkedStudent | null;
  checklist: { checked: boolean }[];
  saving: boolean;
  onBack: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
  onOpenPending: () => void;
  onOpenTrial: () => void;
}

export function BottomActionBar({
  consultation, linkedStudent, checklist, saving,
  onBack, onSave, onOpenPending, onOpenTrial
}: BottomActionBarProps) {
  const checkedCount = checklist.filter(c => c.checked).length;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const syncSidebarState = () => {
      setSidebarCollapsed(localStorage.getItem('sidebar_collapsed') === 'true');
    };

    syncSidebarState();
    const interval = window.setInterval(syncSidebarState, 200);
    return () => window.clearInterval(interval);
  }, []);

  const sidebarOffsetClass = sidebarCollapsed ? 'md:left-[68px]' : 'md:left-64';

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 shadow-lg backdrop-blur ${sidebarOffsetClass}`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        {consultation.consultation_type === 'learning' ? (
          <>
            <div className="min-w-0 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{linkedStudent?.name || consultation.student_name}</span>
              <span className="ml-1">({consultation.student_grade}) 재원생 상담 기록</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Button variant="outline" className="gap-2" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
                돌아가기
              </Button>
              <Button onClick={onSave} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                상담 기록 저장
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="min-w-0 text-sm text-muted-foreground">
              체크리스트 <span className="font-semibold text-foreground">{checkedCount}/{checklist.length}</span>
              <span className="ml-2">완료 후 체험 또는 미등록관리로 연결합니다.</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Button className="col-span-2 gap-2 sm:col-span-1" onClick={onSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                상담 완료 저장
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950"
                onClick={onOpenPending}
                disabled={!!consultation?.linked_student_id}
              >
                <Clock className="h-4 w-4" />
                {consultation?.linked_student_id ? '등록 완료' : '미등록관리로 완료'}
              </Button>
              <Button
                variant="default"
                className="gap-2 bg-green-600 hover:bg-green-700"
                onClick={onOpenTrial}
                disabled={!!consultation?.linked_student_id}
              >
                <Sparkles className="h-4 w-4" />
                {consultation?.linked_student_id ? '이미 체험 등록됨' : '체험 등록'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
