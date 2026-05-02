'use client';

import { Loader2, Save, ArrowLeft, Clock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Consultation } from '@/lib/types/consultation';
import type { LinkedStudent } from '../_types';

interface BottomActionBarProps {
  consultation: Consultation;
  linkedStudent: LinkedStudent | null;
  checklist: { checked: boolean }[];
  saving: boolean;
  backUrl: string;
  onSave: () => void;
  onOpenPending: () => void;
  onOpenTrial: () => void;
}

export function BottomActionBar({
  consultation, linkedStudent, checklist, saving, backUrl,
  onSave, onOpenPending, onOpenTrial
}: BottomActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        {consultation.consultation_type === 'learning' ? (
          <>
            <div className="text-sm text-muted-foreground">
              {linkedStudent?.name || consultation.student_name} ({consultation.student_grade}) 재원생 상담
            </div>
            <div className="flex items-center space-x-3">
              <Link href={backUrl}>
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  돌아가기
                </Button>
              </Link>
              <Button onClick={onSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                상담 기록 저장
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              체크된 항목: {checklist.filter(c => c.checked).length}/{checklist.length}
            </div>
            <div className="flex items-center space-x-3">
              <Button onClick={onSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                저장
              </Button>
              <Button
                variant="outline"
                className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950"
                onClick={onOpenPending}
                disabled={!!consultation?.linked_student_id}
              >
                <Clock className="h-4 w-4 mr-2" />
                {consultation?.linked_student_id ? '등록 완료' : '미등록관리로 완료'}
              </Button>
              <Button
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={onOpenTrial}
                disabled={!!consultation?.linked_student_id}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {consultation?.linked_student_id ? '이미 체험 등록됨' : '체험 등록'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
