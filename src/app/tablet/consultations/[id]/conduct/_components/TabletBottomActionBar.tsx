'use client';

// tablet/consultations/[id]/conduct/_components/TabletBottomActionBar.tsx — 하단 고정 바 (ADR-018)

import { ArrowLeft, Save, Clock, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Consultation } from '@/lib/types/consultation';

interface TabletBottomActionBarProps {
  consultation: Consultation;
  checklist: { checked: boolean }[];
  linkedStudent: { name: string } | null;
  saving: boolean;
  backUrl: string;
  onBack: () => void;
  onSave: () => void;
  onOpenTrial: () => void;
  onOpenPending: () => void;
}

export function TabletBottomActionBar({
  consultation,
  checklist,
  linkedStudent,
  saving,
  backUrl,
  onBack,
  onSave,
  onOpenTrial,
  onOpenPending,
}: TabletBottomActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
      <div className="px-6 py-5 flex items-center justify-between">
        {consultation.consultation_type === 'learning' ? (
          <>
            <div className="text-base text-muted-foreground font-medium">
              {linkedStudent?.name || consultation.student_name} ({consultation.student_grade}) 재원생 상담
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="lg" className="h-12 px-6 text-base" onClick={onBack}>
                <ArrowLeft className="h-5 w-5 mr-2" />
                돌아가기
              </Button>
              <Button size="lg" onClick={onSave} disabled={saving} className="h-12 px-6 text-base bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Save className="h-5 w-5 mr-2" />}
                상담 기록 저장
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-base text-muted-foreground font-medium">
              체크된 항목: <span className="text-primary font-bold">{checklist.filter(c => c.checked).length}</span>/{checklist.length}
            </div>
            <div className="flex items-center gap-3">
              <Button size="lg" onClick={onSave} disabled={saving} className="h-12 px-5 text-base">
                {saving ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Save className="h-5 w-5 mr-2" />}
                저장
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-5 text-base border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950"
                onClick={onOpenPending}
                disabled={!!consultation?.linked_student_id}
              >
                <Clock className="h-5 w-5 mr-2" />
                {consultation?.linked_student_id ? '등록 완료' : '미등록관리'}
              </Button>
              <Button
                size="lg"
                variant="default"
                className="h-12 px-5 text-base bg-green-600 hover:bg-green-700"
                onClick={onOpenTrial}
                disabled={!!consultation?.linked_student_id}
              >
                <Sparkles className="h-5 w-5 mr-2" />
                {consultation?.linked_student_id ? '체험 등록됨' : '체험 등록'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
