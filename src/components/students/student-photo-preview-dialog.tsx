'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface StudentPhotoPreviewDialogProps {
  error: boolean;
  imageUrl: string | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  studentName: string;
}

export function StudentPhotoPreviewDialog({
  error,
  imageUrl,
  loading,
  onOpenChange,
  open,
  studentName,
}: StudentPhotoPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] max-w-[min(92vw,540px)] overflow-hidden rounded-md p-0"
      >
        <DialogHeader className="flex items-center justify-between gap-3 px-4 py-3">
          <DialogTitle className="text-base">{studentName} 사진</DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="닫기"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        <div
          className="flex min-h-[280px] items-center justify-center bg-muted/40 p-4"
          data-testid="student-photo-preview-dialog"
        >
          {loading ? (
            <p className="text-sm text-muted-foreground">사진을 불러오는 중...</p>
          ) : null}
          {error ? (
            <p className="text-sm text-muted-foreground">사진을 불러오지 못했습니다.</p>
          ) : null}
          {imageUrl && !loading && !error ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`${studentName} 사진 확대`}
              className="max-h-[500px] max-w-full object-contain"
              src={imageUrl}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
