'use client';

import { useEffect, useState } from 'react';
import type { Student } from '@/lib/types/student';
import { studentsAPI } from '@/lib/api/students';
import { cn } from '@/lib/utils/cn';

type StudentAvatarSize = 'sm' | 'md' | 'lg';

interface StudentAvatarProps {
  cacheKey?: string | null;
  className?: string;
  forcePhoto?: boolean;
  size?: StudentAvatarSize;
  student: Pick<Student, 'id' | 'name' | 'profile_image_url' | 'profile_thumb_key' | 'profile_image_updated_at'>;
}

const SIZE_CLASSES: Record<StudentAvatarSize, string> = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-14 w-14 text-lg',
  lg: 'h-20 w-20 text-2xl',
};

export function StudentAvatar({ cacheKey, className, forcePhoto, size = 'sm', student }: StudentAvatarProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const hasPhoto = forcePhoto || Boolean(student.profile_thumb_key || student.profile_image_url);
  const resolvedCacheKey = cacheKey || student.profile_image_updated_at || student.profile_thumb_key || student.profile_image_url || '';

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

  return (
    <div
      aria-label={`${student.name} 사진`}
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-950 font-semibold text-slate-50',
        SIZE_CLASSES[size],
        className
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="h-full w-full object-cover" src={imageUrl} />
      ) : (
        <span>{student.name.trim().charAt(0) || '?'}</span>
      )}
    </div>
  );
}
