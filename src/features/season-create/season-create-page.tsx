'use client';

import { useRouter } from 'next/navigation';
import { SeasonCreateForm } from './season-create-form';
import { SeasonCreateHeader } from './season-create-header';
import { useSeasonCreateState } from './use-season-create-state';

export function SeasonCreatePage() {
  const router = useRouter();
  const state = useSeasonCreateState(() => router.push('/seasons'));

  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-5xl" data-testid="season-create-workspace">
      <SeasonCreateHeader onBack={() => router.back()} />
      <SeasonCreateForm
        currentYear={state.currentYear}
        error={state.error}
        formData={state.formData}
        onCancel={() => router.back()}
        onChange={state.changeField}
        onSubmit={state.submit}
        onToggleOperatingDay={state.toggleOperatingDay}
        onToggleTimeSlot={state.toggleTimeSlot}
        submitting={state.submitting}
      />
    </div>
  );
}
