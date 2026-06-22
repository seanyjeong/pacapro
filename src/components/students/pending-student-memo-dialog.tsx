'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { Student } from '@/lib/types/student';
import { FileText, Loader2, MessageSquare, Save, StickyNote } from 'lucide-react';

export interface PendingStudentMemoData {
  student: Student;
  inquiryContent: string;
  consultationMemo: string;
}

interface PendingStudentMemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PendingStudentMemoData | null;
  loading: boolean;
  pendingMemo: string;
  saving: boolean;
  onPendingMemoChange: (memo: string) => void;
  onSave: () => void;
}

export function PendingStudentMemoDialog({
  open,
  onOpenChange,
  data,
  loading,
  pendingMemo,
  saving,
  onPendingMemoChange,
  onSave,
}: PendingStudentMemoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            {data?.student.name} 메모
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {data?.inquiryContent && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    상담 신청 문의
                  </label>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-blue-950/30">
                    {data.inquiryContent}
                  </div>
                </div>
              )}

              {data?.consultationMemo && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <FileText className="h-4 w-4 text-green-500" />
                    상담 메모
                  </label>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm dark:border-green-800 dark:bg-green-950/30">
                    {data.consultationMemo}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <StickyNote className="h-4 w-4 text-orange-500" />
                  미등록관리 메모
                  <span className="text-xs text-muted-foreground/70">(수정 가능)</span>
                </label>
                <Textarea
                  value={pendingMemo}
                  onChange={(event) => onPendingMemoChange(event.target.value)}
                  placeholder="메모를 입력하세요..."
                  className="min-h-[100px] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  취소
                </Button>
                <Button onClick={onSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  저장
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
