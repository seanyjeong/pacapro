'use client';

// tablet/consultations/[id]/conduct/_components/TabletBottomActionBar.tsx — 하단 고정 바 (ADR-018)

import { ArrowLeft, Save, Clock, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrientation } from '@/components/tablet/orientation-context';
import type { Consultation } from '@/lib/types/consultation';

interface TabletBottomActionBarProps {
  consultation: Consultation;
  checklist: { checked: boolean }[];
  linkedStudent: { name: string } | null;
  saving: boolean;
  onBack: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
  onOpenTrial: () => void;
  onOpenPending: () => void;
}

export function TabletBottomActionBar({
  consultation,
  checklist,
  linkedStudent,
  saving,
  onBack,
  onSave,
  onOpenTrial,
  onOpenPending,
}: TabletBottomActionBarProps) {
  const checkedCount = checklist.filter(c => c.checked).length;
  const orientation = useOrientation();
  // 태블릿 레이아웃: 가로는 왼쪽 메뉴(88px), 세로는 아래 탭(약 80px) 위에 놓는다.
  const positionClass = orientation === 'landscape' ? 'bottom-0 left-[88px]' : 'bottom-20 left-0';

  return (
    <div className={`fixed right-0 z-50 border-t border-border/60 bg-card/95 backdrop-blur ${positionClass}`}>
      <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        {consultation.consultation_type === 'learning' ? (
          <>
            <div className="text-base font-medium text-muted-foreground">
              <span className="text-foreground">{linkedStudent?.name || consultation.student_name}</span>
              <span className="ml-1">({consultation.student_grade}) 재원생 상담 기록</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Button variant="outline" className="h-12 px-6 text-base" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
                돌아가기
              </Button>
              <Button onClick={onSave} disabled={saving} className="h-12 bg-success px-6 text-base text-success-foreground hover:bg-success/90">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                상담 기록 저장
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-base font-semibold text-muted-foreground">
              체크리스트 <span className="font-extrabold text-primary tabular-nums">{checkedCount}</span>/{checklist.length}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
              <Button onClick={onSave} disabled={saving} className="h-12 px-5 text-base">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                상담 완료 저장
              </Button>
              <Button
                variant="outline"
                className="h-12 bg-warning-soft px-5 text-base text-warning hover:bg-warning-soft/70 hover:text-warning"
                onClick={onOpenPending}
                disabled={!!consultation?.linked_student_id}
              >
                <Clock className="h-5 w-5" />
                {consultation?.linked_student_id ? '등록 완료' : '미등록관리'}
              </Button>
              <Button
                variant="default"
                className="h-12 bg-success px-5 text-base text-success-foreground hover:bg-success/90"
                onClick={onOpenTrial}
                disabled={!!consultation?.linked_student_id}
              >
                <Sparkles className="h-5 w-5" />
                {consultation?.linked_student_id ? '체험 등록됨' : '체험 등록'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
