'use client';

import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AcademyBasicCard } from './academy-basic-card';
import { ClassTimeCard } from './class-time-card';
import { DangerResetCard } from './danger-reset-card';
import { SalarySettingsCard } from './salary-settings-card';
import { SettingsHeader } from './settings-header';
import { SettingsOperationPanel } from './settings-operation-panel';
import { SettingsResetConfirmDialog } from './settings-reset-confirm-dialog';
import { SettingsSystemCard } from './settings-system-card';
import { TUITION_SECTIONS } from './settings-constants';
import { TuitionSectionCard } from './tuition-section-card';
import { UserInfoCard } from './user-info-card';
import { useSettingsPageState } from './use-settings-page-state';
import { GoogleIntegrationCard } from '@/features/google-integration/google-integration-card';
import { BranchClassCard } from '@/features/branches/branch-class-card';

export function SettingsPage() {
  const state = useSettingsPageState();
  const isOwner = state.user?.role === 'owner';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <SettingsHeader
        hasUnsavedChanges={state.hasUnsavedChanges}
        isLoading={state.isLoadingSettings}
        isSaving={state.isSaving}
        onSave={state.saveSettings}
      />

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
        <SettingsOperationPanel isOwner={isOwner} />

        <main className="min-w-0 space-y-4">
          <AcademyBasicCard settings={state.settings} updateSetting={state.updateSetting} />
          <ClassTimeCard
            settings={state.settings}
            updateClassTime={state.updateClassTime}
            updateClassAvailability={state.updateClassAvailability}
          />
          {TUITION_SECTIONS.map((section) => (
            <TuitionSectionCard
              key={section.kind}
              kind={section.kind}
              title={section.title}
              description={section.description}
              settings={state.settings}
              updateTuition={state.updateTuition}
            />
          ))}
          <SalarySettingsCard settings={state.settings} updateSetting={state.updateSetting} />
          <div className="flex justify-end">
            <Button
              onClick={state.saveSettings}
              disabled={state.isLoadingSettings || state.isSaving || !state.hasUnsavedChanges}
              variant={state.hasUnsavedChanges ? 'default' : 'outline'}
              size="lg"
              className="w-full sm:w-auto"
            >
              <Save className="h-5 w-5" />
              {state.isSaving ? '저장 중...' : state.hasUnsavedChanges ? '학원 설정 저장' : '저장됨'}
            </Button>
          </div>
          <BranchClassCard />
          {isOwner && <GoogleIntegrationCard />}
          <UserInfoCard user={state.user} loading={state.isLoadingSettings} />
          <SettingsSystemCard />
          {isOwner ? (
            <DangerResetCard
              resetConfirmation={state.resetConfirmation}
              isResetting={state.isResetting}
              setResetConfirmation={state.setResetConfirmation}
              onReset={state.handleResetAllData}
            />
          ) : null}
        </main>
      </div>

      <SettingsResetConfirmDialog
        isResetting={state.isResetting}
        open={state.resetDialogOpen}
        onConfirm={state.confirmResetAllData}
        onOpenChange={state.handleResetDialogOpenChange}
      />
    </div>
  );
}
