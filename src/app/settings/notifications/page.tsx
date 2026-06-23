'use client';

// Phase 4 #1 — notifications/page.tsx 분리 (ADR-017)
// 3,783줄 → 얇은 오케스트레이터 (hook + sub-components)
// UX/스크린 변경 0 (ADR-013), 타입 시그니처 무변경

import { Bell, ChevronDown, ChevronUp } from 'lucide-react';
import PushNotificationSettings from '@/components/push-notification-settings';
import { useNotificationSettings } from './_hooks/useNotificationSettings';
import NotificationToggles from './_components/NotificationToggles';
import NotificationConfirmDialog from './_components/NotificationConfirmDialog';
import NotificationsHeader from './_components/NotificationsHeader';
import NotificationsLoadingState from './_components/NotificationsLoadingState';
import NotificationsOperationsBoard from './_components/NotificationsOperationsBoard';
import NotificationsStatusBanner from './_components/NotificationsStatusBanner';
import ServiceTabSelector from './_components/ServiceTabSelector';
import SensApiSettings from './_components/SensApiSettings';
import SolapiApiSettings from './_components/SolapiApiSettings';
import SolapiTemplates from './_components/SolapiTemplates';
import SensTemplates from './_components/SensTemplates';
import SetupGuide from './_components/SetupGuide';
import SendLogs from './_components/SendLogs';

export default function NotificationSettingsPage() {
  const h = useNotificationSettings();
  const isEnabled = h.settings.service_type === 'solapi' ? h.settings.solapi_enabled : h.settings.is_enabled;
  const serviceLabel = h.settings.service_type === 'solapi' ? '솔라피' : '네이버 SENS';

  if (h.loading) {
    return <NotificationsLoadingState />;
  }

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl">
        <NotificationsHeader
          isEnabled={isEnabled}
          logCount={h.logs.length}
          senderCount={h.senderNumbers.length}
          serviceLabel={serviceLabel}
        />

        <NotificationsStatusBanner loadErrors={h.loadErrors} message={h.message} />

        <div className="grid gap-5 xl:grid-cols-12 xl:items-start">
          <aside className="order-1 min-w-0 xl:sticky xl:top-20 xl:order-2 xl:col-span-4 xl:col-start-9 xl:row-start-1">
            <NotificationsOperationsBoard state={h} />
          </aside>

          <section className="order-2 min-w-0 space-y-5 xl:order-1 xl:col-span-8 xl:row-span-2 xl:row-start-1">
            <NotificationToggles
              settings={h.settings}
              setSettings={h.setSettings}
              showSolapiSettingsSection={h.showSolapiSettingsSection}
              setShowSolapiSettingsSection={h.setShowSolapiSettingsSection}
              saving={h.saving}
              onSave={h.handleSave}
            />

            <ServiceTabSelector
              settings={h.settings}
              activeTab={h.activeTab}
              showPriceModal={h.showPriceModal}
              setShowPriceModal={h.setShowPriceModal}
              onServiceTypeChange={h.handleServiceTypeChange}
            />

            {h.activeTab === 'sens' && (
              <SensApiSettings
                settings={h.settings}
                setSettings={h.setSettings}
                senderNumbers={h.senderNumbers}
                newSenderPhone={h.newSenderPhone}
                setNewSenderPhone={h.setNewSenderPhone}
                newSenderLabel={h.newSenderLabel}
                setNewSenderLabel={h.setNewSenderLabel}
                addingSender={h.addingSender}
                onAddSender={h.handleAddSenderNumber}
                onSetDefaultSender={h.handleSetDefaultSender}
                onDeleteSender={h.handleDeleteSenderNumber}
              />
            )}

            {h.activeTab === 'solapi' && (
              <SolapiApiSettings
                settings={h.settings}
                setSettings={h.setSettings}
                senderNumbers={h.senderNumbers}
                newSenderPhone={h.newSenderPhone}
                setNewSenderPhone={h.setNewSenderPhone}
                newSenderLabel={h.newSenderLabel}
                setNewSenderLabel={h.setNewSenderLabel}
                addingSender={h.addingSender}
                onAddSender={h.handleAddSenderNumber}
                onSetDefaultSender={h.handleSetDefaultSender}
                onDeleteSender={h.handleDeleteSenderNumber}
              />
            )}

            {h.activeTab === 'solapi' && (
              <SolapiTemplates
                settings={h.settings}
                setSettings={h.setSettings}
                activeTemplate={h.activeTemplate}
                setActiveTemplate={h.setActiveTemplate}
                academyName={h.academyName}
                saving={h.saving}
                onSave={h.handleSave}
                testing={h.testing}
                testPhone={h.testPhone}
                setTestPhone={h.setTestPhone}
                onTest={h.handleTest}
                sendingUnpaid={h.sendingUnpaid}
                onSendUnpaid={h.handleSendUnpaid}
                testingConsultation={h.testingConsultation}
                testPhoneConsultation={h.testPhoneConsultation}
                setTestPhoneConsultation={h.setTestPhoneConsultation}
                onTestConsultation={h.handleTestConsultation}
                testingTrial={h.testingTrial}
                testPhoneTrial={h.testPhoneTrial}
                setTestPhoneTrial={h.setTestPhoneTrial}
                onTestTrial={h.handleTestTrial}
                testingOverdue={h.testingOverdue}
                testPhoneOverdue={h.testPhoneOverdue}
                setTestPhoneOverdue={h.setTestPhoneOverdue}
                onTestOverdue={h.handleTestOverdue}
                testingReminder={h.testingReminder}
                testPhoneReminder={h.testPhoneReminder}
                setTestPhoneReminder={h.setTestPhoneReminder}
                onTestReminder={h.handleTestReminder}
                testingAttendance={h.testingAttendance}
                testPhoneAttendance={h.testPhoneAttendance}
                setTestPhoneAttendance={h.setTestPhoneAttendance}
                onTestAttendance={h.handleTestAttendance}
                addUnpaidButton={h.addUnpaidButton}
                removeUnpaidButton={h.removeUnpaidButton}
                updateUnpaidButton={h.updateUnpaidButton}
                addConsultationButton={h.addConsultationButton}
                removeConsultationButton={h.removeConsultationButton}
                updateConsultationButton={h.updateConsultationButton}
                addTrialButton={h.addTrialButton}
                removeTrialButton={h.removeTrialButton}
                updateTrialButton={h.updateTrialButton}
                addOverdueButton={h.addOverdueButton}
                removeOverdueButton={h.removeOverdueButton}
                updateOverdueButton={h.updateOverdueButton}
                addReminderButton={h.addReminderButton}
                removeReminderButton={h.removeReminderButton}
                updateReminderButton={h.updateReminderButton}
              />
            )}

            <SensTemplates
              activeTab={h.activeTab}
              activeSensTemplate={h.activeSensTemplate}
              setActiveSensTemplate={h.setActiveSensTemplate}
              settings={h.settings}
              setSettings={h.setSettings}
              saving={h.saving}
              testing={h.testing}
              testPhone={h.testPhone}
              setTestPhone={h.setTestPhone}
              testingSensConsultation={h.testingSensConsultation}
              testingSensTrial={h.testingSensTrial}
              testingSensOverdue={h.testingSensOverdue}
              testingSensReminder={h.testingSensReminder}
              testingSensAttendance={h.testingSensAttendance}
              testPhoneSensConsultation={h.testPhoneSensConsultation}
              setTestPhoneSensConsultation={h.setTestPhoneSensConsultation}
              testPhoneSensTrial={h.testPhoneSensTrial}
              setTestPhoneSensTrial={h.setTestPhoneSensTrial}
              testPhoneSensOverdue={h.testPhoneSensOverdue}
              setTestPhoneSensOverdue={h.setTestPhoneSensOverdue}
              testPhoneSensReminder={h.testPhoneSensReminder}
              setTestPhoneSensReminder={h.setTestPhoneSensReminder}
              testPhoneSensAttendance={h.testPhoneSensAttendance}
              setTestPhoneSensAttendance={h.setTestPhoneSensAttendance}
              handleSave={h.handleSave}
              handleTest={h.handleTest}
              handleTestSensConsultation={h.handleTestSensConsultation}
              handleTestSensTrial={h.handleTestSensTrial}
              handleTestSensOverdue={h.handleTestSensOverdue}
              handleTestSensReminder={h.handleTestSensReminder}
              handleTestSensAttendance={h.handleTestSensAttendance}
              addSensUnpaidButton={h.addSensUnpaidButton}
              removeSensUnpaidButton={h.removeSensUnpaidButton}
              updateSensUnpaidButton={h.updateSensUnpaidButton}
              addSensConsultationButton={h.addSensConsultationButton}
              removeSensConsultationButton={h.removeSensConsultationButton}
              updateSensConsultationButton={h.updateSensConsultationButton}
              addSensTrialButton={h.addSensTrialButton}
              removeSensTrialButton={h.removeSensTrialButton}
              updateSensTrialButton={h.updateSensTrialButton}
              addSensOverdueButton={h.addSensOverdueButton}
              removeSensOverdueButton={h.removeSensOverdueButton}
              updateSensOverdueButton={h.updateSensOverdueButton}
              addSensReminderButton={h.addSensReminderButton}
              removeSensReminderButton={h.removeSensReminderButton}
              updateSensReminderButton={h.updateSensReminderButton}
            />
          </section>

          <aside className="order-3 min-w-0 space-y-5 xl:col-span-4 xl:col-start-9 xl:row-start-2">
            <div className="rounded-md border border-border bg-card shadow-none">
              <button
                onClick={() => h.setShowPushSection(!h.showPushSection)}
                className="flex w-full items-center justify-between rounded-md p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-foreground">PWA 푸시 알림 설정</span>
                </div>
                {h.showPushSection ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </button>
              {h.showPushSection && (
                <div className="border-t border-border">
                  <PushNotificationSettings />
                </div>
              )}
            </div>

            <SendLogs logs={h.logs} />

            <SetupGuide
              activeTab={h.activeTab}
              openGuides={h.openGuides}
              toggleGuide={h.toggleGuide}
            />
          </aside>
        </div>

        <NotificationConfirmDialog
          deletingSenderId={h.deletingSenderId}
          open={Boolean(h.pendingConfirmation)}
          pending={h.pendingConfirmation}
          sendingUnpaid={h.sendingUnpaid}
          onConfirm={h.confirmPendingAction}
          onOpenChange={h.handlePendingConfirmationOpenChange}
        />
      </div>
    </main>
  );
}
