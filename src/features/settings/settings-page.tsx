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

export function SettingsPage() {
  const state = useSettingsPageState();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <SettingsHeader
        hasUnsavedChanges={state.hasUnsavedChanges}
        isLoading={state.isLoadingSettings}
        isSaving={state.isSaving}
        onSave={state.saveSettings}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-5">
          <AcademyBasicCard settings={state.settings} updateSetting={state.updateSetting} />
          <ClassTimeCard settings={state.settings} updateClassTime={state.updateClassTime} />
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
          <div className="flex justify-end border-t border-border/70 pt-4">
            <Button
              onClick={state.saveSettings}
              disabled={state.isLoadingSettings || state.isSaving || !state.hasUnsavedChanges}
              variant={state.hasUnsavedChanges ? 'default' : 'secondary'}
              size="lg"
            >
              <Save className="mr-2 h-4 w-4" />
              {state.isSaving ? '저장 중...' : state.hasUnsavedChanges ? '학원 설정 저장' : '저장됨'}
            </Button>
          </div>
        </main>

        <aside className="order-first space-y-5 xl:order-none xl:sticky xl:top-20 xl:self-start">
          <SettingsOperationPanel
            settings={state.settings}
            hasUnsavedChanges={state.hasUnsavedChanges}
            isSaving={state.isSaving}
          />
          <UserInfoCard user={state.user} loading={state.isLoadingSettings} />
          <SettingsSystemCard />
          {state.user?.role === 'owner' ? (
            <DangerResetCard
              resetConfirmation={state.resetConfirmation}
              isResetting={state.isResetting}
              setResetConfirmation={state.setResetConfirmation}
              onReset={state.handleResetAllData}
            />
          ) : null}
        </aside>
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
