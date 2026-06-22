import { Suspense } from 'react';
import { ClassDaysPage } from '@/features/class-days/class-days-page';
import { ClassDaysLoading } from '@/features/class-days/class-days-loading';

export default function ClassDaysRoute() {
  return (
    <Suspense fallback={<ClassDaysLoading />}>
      <ClassDaysPage />
    </Suspense>
  );
}
