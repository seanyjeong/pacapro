'use client';

import { useEffect, useState } from 'react';
import type { Student } from '@/lib/types/student';
import { studentsAPI } from '@/lib/api/students';
import { cn } from '@/lib/utils/cn';
import { StudentPhotoPreviewDialog } from './student-photo-preview-dialog';

type StudentAvatarSize = 'sm' | 'md' | 'lg' | 'xl';
type StudentAvatarFit = 'cover' | 'contain';

interface StudentAvatarProps {
  cacheKey?: string | null;
  className?: string;
  forcePhoto?: boolean;
  imageFit?: StudentAvatarFit;
  size?: StudentAvatarSize;
  student: Pick<Student, 'id' | 'name' | 'profile_image_key' | 'profile_image_url' | 'profile_thumb_key' | 'profile_image_updated_at'>;
}

const SIZE_CLASSES: Record<StudentAvatarSize, string> = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-14 w-14 text-lg',
  lg: 'h-20 w-20 text-2xl',
  xl: 'h-36 w-36 text-5xl sm:h-40 sm:w-40',
};

const IMAGE_FIT_CLASSES: Record<StudentAvatarFit, string> = {
  contain: 'object-contain',
  cover: 'object-cover',
};

export function StudentAvatar({ cacheKey, className, forcePhoto, imageFit = 'cover', size = 'sm', student }: StudentAvatarProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const hasPhoto = forcePhoto || Boolean(student.profile_thumb_key || student.profile_image_url || student.profile_image_key);
  const resolvedCacheKey = cacheKey || student.profile_image_updated_at || student.profile_thumb_key || student.profile_image_key || student.profile_image_url || '';

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!hasPhoto) {
      setImageUrl(null);
      return undefined;
    }

    studentsAPI
      .getStudentPhotoBlob(student.id, 'thumb', {
        params: { v: resolvedCacheKey },
        suppressErrorToast: true,
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch(() => {
        if (active) setImageUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [hasPhoto, resolvedCacheKey, student.id]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!previewOpen || !hasPhoto) return undefined;

    setPreviewLoading(true);
    setPreviewError(false);
    studentsAPI
      .getStudentPhotoBlob(student.id, 'original', {
        params: { v: resolvedCacheKey },
        suppressErrorToast: true,
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (active) setPreviewError(true);
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
    };
  }, [hasPhoto, previewOpen, resolvedCacheKey, student.id]);

  const avatarBody = imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className={cn('h-full w-full', IMAGE_FIT_CLASSES[imageFit])} src={imageUrl} />
  ) : (
    <span>{student.name.trim().charAt(0) || '?'}</span>
  );

  return (
    <>
      <div
        aria-label={`${student.name} 사진`}
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden rounded-md font-semibold text-slate-50',
          imageUrl && imageFit === 'contain' ? 'bg-muted' : 'bg-slate-950',
          SIZE_CLASSES[size],
          className
        )}
      >
        {imageUrl ? (
          <button
            type="button"
            aria-label={`${student.name} 사진 크게 보기`}
            className="h-full w-full cursor-zoom-in overflow-hidden rounded-md"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setPreviewOpen(true);
            }}
          >
            {avatarBody}
          </button>
        ) : (
          avatarBody
        )}
      </div>
      <StudentPhotoPreviewDialog
        error={previewError}
        imageUrl={previewUrl}
        loading={previewLoading}
        open={previewOpen}
        studentName={student.name}
        onOpenChange={setPreviewOpen}
      />
    </>
  );
}
