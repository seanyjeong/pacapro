'use client';

import { Loader2 } from 'lucide-react';
import { BlockedSlotDialog } from './blocked-slot-dialog';
import { BlockedSlotsSection } from './blocked-slots-section';
import { ChecklistItemDialog } from './checklist-item-dialog';
import { ChecklistTemplateSection } from './checklist-template-section';
import { PageSettingsSection } from './page-settings-section';
import { ReferralSourcesSection } from './referral-sources-section';
import { ReservationLinkSection } from './reservation-link-section';
import { SettingsHeader } from './settings-header';
import { useConsultationSettingsState } from './use-consultation-settings-state';
import { WeeklyHoursSection } from './weekly-hours-section';

export function ConsultationSettingsPage() {
  const state = useConsultationSettingsState();

  if (state.loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsHeader academyName={state.academyName} />

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
    </div>
  );
}
