'use client';

import { AlertCircle } from 'lucide-react';
import { BlockedSlotDialog } from './blocked-slot-dialog';
import { BlockedSlotsSection } from './blocked-slots-section';
import { ChecklistItemDialog } from './checklist-item-dialog';
import { ChecklistTemplateSection } from './checklist-template-section';
import { PageSettingsSection } from './page-settings-section';
import { ReferralSourcesSection } from './referral-sources-section';
import { ReservationLinkSection } from './reservation-link-section';
import { SettingsOperationsBoard } from './settings-operations-board';
import { SettingsHeader } from './settings-header';
import { useConsultationSettingsState } from './use-consultation-settings-state';
import { WeeklyHoursSection } from './weekly-hours-section';

export function ConsultationSettingsPage() {
  const state = useConsultationSettingsState();

  if (state.loading) {
    return (
      <main className="min-h-screen bg-muted/20 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl">
          <div className="h-32 rounded-md border border-border bg-card" />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
            <div className="space-y-5">
              <div className="h-64 rounded-md border border-border bg-card" />
              <div className="h-80 rounded-md border border-border bg-card" />
            </div>
            <div className="space-y-5">
              <div className="h-52 rounded-md border border-border bg-card" />
              <div className="h-72 rounded-md border border-border bg-card" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  const savedWeeklyAvailableCount = state.hasSavedWeeklyHours
    ? state.weeklyHours.filter((hour) => hour.isAvailable).length
    : 0;

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl" data-testid="consultation-settings-operations-workspace">
        <SettingsHeader
          academyName={state.academyName}
          blockedCount={state.blockedSlots.length}
          isEnabled={state.settings.isEnabled}
          originalSlug={state.originalSlug}
          weeklyAvailableCount={savedWeeklyAvailableCount}
        />

        {state.loadError ? (
          <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/45 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold">상담 예약 설정을 불러오지 못했습니다</h2>
                <p className="mt-1 text-sm">{state.loadError}</p>
              </div>
            </div>
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
            <div className="order-2 min-w-0 space-y-5 lg:order-1">
              <ReservationLinkSection
                isEnabled={state.settings.isEnabled}
                slug={state.slug}
                originalSlug={state.originalSlug}
                slugAvailable={state.slugAvailable}
                checkingSlug={state.checkingSlug}
                savingSlug={state.savingSlug}
                copied={state.copied}
                onEnabledChange={(checked) => state.updateSetting('isEnabled', checked)}
                onSlugChange={state.setSlugValue}
                onCheckSlug={state.checkSlug}
                onSaveSlug={state.handleSaveSlug}
                onCopyLink={state.copyLink}
              />

              <PageSettingsSection
                settings={state.settings}
                saving={state.saving}
                onSettingChange={state.updateSetting}
                onSave={state.handleSaveSettings}
              />

              <WeeklyHoursSection
                weeklyHours={state.weeklyHours}
                defaultStartTime={state.defaultStartTime}
                defaultEndTime={state.defaultEndTime}
                timeOptions={state.timeOptions}
                saving={state.saving}
                onDefaultStartTimeChange={state.setDefaultStartTime}
                onDefaultEndTimeChange={state.setDefaultEndTime}
                onApplyAll={state.applyDefaultTimeToAll}
                onApplyWeekdays={state.applyDefaultTimeToWeekdays}
                onUpdateHour={state.updateHour}
                onSave={state.handleSaveWeeklyHours}
              />
            </div>

            <aside className="order-1 min-w-0 space-y-5 lg:order-2">
              <SettingsOperationsBoard
                blockedCount={state.blockedSlots.length}
                hasSavedWeeklyHours={state.hasSavedWeeklyHours}
                isEnabled={state.settings.isEnabled}
                originalSlug={state.originalSlug}
                referralCount={state.settings.referralSources?.length || 0}
                weeklyAvailableCount={savedWeeklyAvailableCount}
              />

              <BlockedSlotsSection
                blockedSlots={state.blockedSlots}
                addingHolidays={state.addingHolidays}
                onOpenBlockModal={() => state.setBlockModalOpen(true)}
                onAddAllHolidays={state.handleAddAllHolidays}
                onRemoveBlockedSlot={state.handleRemoveBlockedSlot}
              />

              <ReferralSourcesSection
                settings={state.settings}
                newReferralSource={state.newReferralSource}
                saving={state.saving}
                onNewReferralSourceChange={state.setNewReferralSource}
                onAddReferralSource={state.addReferralSource}
                onRemoveReferralSource={state.removeReferralSource}
                onSave={state.handleSaveSettings}
              />

              <ChecklistTemplateSection
                checklistTemplate={state.checklistTemplate}
                checklistCategories={state.checklistCategories}
                savingChecklist={state.savingChecklist}
                onOpenAddDialog={() => state.setAddChecklistModalOpen(true)}
                onResetDefault={state.resetToDefaultChecklist}
                onSave={state.saveChecklist}
                onRemoveItem={state.removeChecklistItem}
              />
            </aside>
          </div>
        )}
      </div>

      <ChecklistItemDialog
        open={state.addChecklistModalOpen}
        checklistCategories={state.checklistCategories}
        newChecklistItem={state.newChecklistItem}
        onOpenChange={state.setAddChecklistModalOpen}
        onItemChange={state.updateNewChecklistItem}
        onAdd={state.addChecklistItem}
      />

      <BlockedSlotDialog
        open={state.blockModalOpen}
        newBlockedDate={state.newBlockedDate}
        newBlockReason={state.newBlockReason}
        addingBlock={state.addingBlock}
        onOpenChange={state.setBlockModalOpen}
        onDateChange={state.setNewBlockedDate}
        onReasonChange={state.setNewBlockReason}
        onAdd={state.handleAddBlockedSlot}
      />
    </main>
  );
}
