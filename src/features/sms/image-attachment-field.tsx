import { Image as ImageIcon, X } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import type { SmsImageFile } from './sms-types';

interface ImageAttachmentFieldProps {
  images: SmsImageFile[];
  onImageSelect: (files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
}

export function ImageAttachmentField({ images, onImageSelect, onRemoveImage }: ImageAttachmentFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">이미지 첨부</h3>
          <p className="mt-1 text-xs text-muted-foreground">JPG, PNG · 300KB 이하 · 최대 3장</p>
        </div>
        {images.length < 3 && (
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <ImageIcon className="h-4 w-4" />
            추가
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        multiple
        className="hidden"
        onChange={(event) => {
          onImageSelect(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />

      {images.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {images.map((image, index) => (
            <div key={image.preview} className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
              <div
                role="img"
                aria-label={image.name}
                className="h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${image.preview})` }}
              />
              <button
                type="button"
                onClick={() => onRemoveImage(index)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/95 text-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                aria-label={`${image.name} 삭제`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          이미지 없이 발송하면 SMS 또는 LMS로 처리됩니다.
        </div>
      )}
    </section>
  );
}
