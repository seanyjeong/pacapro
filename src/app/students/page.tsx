'use client';

import { Suspense } from 'react';
import { StudentsPageContent } from '@/features/students/students-page-content';
import { StudentsPageLoading } from '@/features/students/students-page-loading';

export default function StudentsPage() {
  return (
    <Suspense fallback={<StudentsPageLoading />}>
      <StudentsPageContent />
    </Suspense>
  );
}
