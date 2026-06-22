'use client';

// Phase 4 #1 — notifications/page.tsx 분리 (ADR-017)
// 3,783줄 → 얇은 오케스트레이터 (hook + sub-components)
// UX/스크린 변경 0 (ADR-013), 타입 시그니처 무변경

import { Bell, ChevronDown, ChevronUp } from 'lucide-react';
import PushNotificationSettings from '@/components/push-notification-settings';
import { useNotificationSettings } from './_hooks/useNotificationSettings';
import NotificationToggles from './_components/NotificationToggles';
import ServiceTabSelector from './_components/ServiceTabSelector';
import SensApiSettings from './_components/SensApiSettings';
import SolapiApiSettings from './_components/SolapiApiSettings';
import SolapiTemplates from './_components/SolapiTemplates';
import SensTemplates from './_components/SensTemplates';
import SetupGuide from './_components/SetupGuide';
import SendLogs from './_components/SendLogs';

export default function NotificationSettingsPage() {
  const h = useNotificationSettings();

  if (h.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Bell className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">알림톡 및 SMS 설정</h1>
          <p className="text-muted-foreground">KakaoTalk 알림톡과 SMS 발송을 위한 설정</p>
        </div>
      </div>

      {/* 메시지 */}
      {h.message && (
        <div className={`p-4 rounded-lg ${h.message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {h.message.text}
        </div>
      )}

      {/* PWA 푸시 알림 설정 */}
      <div className="bg-card rounded-lg shadow-sm border border-border">
        <button
          onClick={() => h.setShowPushSection(!h.showPushSection)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-foreground">PWA 푸시 알림 설정</span>
          </div>
          {h.showPushSection ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </button>
        {h.showPushSection && (
          <div className="border-t border-border">
            <PushNotificationSettings />
          </div>
        )}
      </div>

      {/* 알림톡 발송 설정 (토글들) */}
      <NotificationToggles
        settings={h.settings}
        setSettings={h.setSettings}
        showSolapiSettingsSection={h.showSolapiSettingsSection}
        setShowSolapiSettingsSection={h.setShowSolapiSettingsSection}
        saving={h.saving}
        onSave={h.handleSave}
      />

      {/* 서비스 선택 탭 + 가격 비교 모달 */}
      <ServiceTabSelector
        settings={h.settings}
        activeTab={h.activeTab}
        showPriceModal={h.showPriceModal}
        setShowPriceModal={h.setShowPriceModal}
        onServiceTypeChange={h.handleServiceTypeChange}
      />

      {/* SENS API 설정 */}
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

      {/* 솔라피 API 설정 */}
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

      {/* 솔라피 템플릿 (탭 + 5개 폼) */}
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

      {/* SENS 템플릿 (탭 + 5개 폼) */}
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

      {/* 설정 가이드 */}
      <SetupGuide
        activeTab={h.activeTab}
        openGuides={h.openGuides}
        toggleGuide={h.toggleGuide}
      />

      {/* 최근 발송 내역 */}
      <SendLogs logs={h.logs} />
    </div>
  );
}
