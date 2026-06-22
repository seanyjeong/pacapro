'use client';

import { useParams, useRouter } from 'next/navigation';
import { SeasonEditError } from './season-edit-error';
import { SeasonEditForm } from './season-edit-form';
import { SeasonEditHeader } from './season-edit-header';
import { SeasonEditLoading } from './season-edit-loading';
import { useSeasonEditState } from './use-season-edit-state';

export function SeasonEditPage() {
  const router = useRouter();
  const params = useParams();
  const seasonId = Number(params.id);
  const state = useSeasonEditState(seasonId, () => router.push(`/seasons/${seasonId}`));

  if (state.loading) return <SeasonEditLoading />;

  if (state.loadError) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-5xl" data-testid="season-edit-workspace">
        <SeasonEditHeader onBack={() => router.back()} />
        <SeasonEditError message={state.loadError} onBack={() => router.push('/seasons')} onRetry={state.reload} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-5xl" data-testid="season-edit-workspace">
      <SeasonEditHeader onBack={() => router.back()} />
      <SeasonEditForm
        error={state.saveError}
        formData={state.formData}
        onCancel={() => router.back()}
        onChange={state.changeField}
        onSubmit={state.submit}
        onToggleOperatingDay={state.toggleOperatingDay}
        onToggleTimeSlot={state.toggleTimeSlot}
        saving={state.saving}
      />
    </div>
  );
}
