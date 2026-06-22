'use client';

// Phase 4 #1 — notifications/page.tsx 분리 (ADR-017)
// 모든 state + handler + API 호출을 이 hook으로 추출
// props 전달: page.tsx → sub-components

import { useCallback, useState, useEffect } from 'react';
import { notificationsAPI, NotificationSettings, NotificationLog, ConsultationButton } from '@/lib/api/notifications';
import apiClient from '@/lib/api/client';
import { smsAPI } from '@/lib/api/sms';
import { SenderNumber, ServiceType, TemplateType } from '../_types';
import { createDefaultNotificationSettings } from './notification-default-settings';
import {
  appendNotificationButton,
  removeNotificationButton,
  type NotificationButtonField,
  updateNotificationButton,
} from './notification-button-updaters';

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(() => createDefaultNotificationSettings());

  const [activeTab, setActiveTab] = useState<ServiceType>('sens');
  const [activeSensTemplate, setActiveSensTemplate] = useState<TemplateType>('unpaid');
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingConsultation, setTestingConsultation] = useState(false);
  const [testingTrial, setTestingTrial] = useState(false);
  const [testingOverdue, setTestingOverdue] = useState(false);
  // SENS 테스트 상태
  const [testingSensConsultation, setTestingSensConsultation] = useState(false);
  const [testingSensTrial, setTestingSensTrial] = useState(false);
  const [testingSensOverdue, setTestingSensOverdue] = useState(false);
  const [testingSensReminder, setTestingSensReminder] = useState(false);
  // 솔라피 리마인드 테스트 상태
  const [testingReminder, setTestingReminder] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testPhoneConsultation, setTestPhoneConsultation] = useState('');
  const [testPhoneTrial, setTestPhoneTrial] = useState('');
  const [testPhoneOverdue, setTestPhoneOverdue] = useState('');
  const [testPhoneReminder, setTestPhoneReminder] = useState('');
  // SENS 테스트 전화번호
  const [testPhoneSensConsultation, setTestPhoneSensConsultation] = useState('');
  const [testPhoneSensTrial, setTestPhoneSensTrial] = useState('');
  const [testPhoneSensOverdue, setTestPhoneSensOverdue] = useState('');
  const [testPhoneSensReminder, setTestPhoneSensReminder] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sendingUnpaid, setSendingUnpaid] = useState(false);

  const [showPriceModal, setShowPriceModal] = useState(false);
  const [openGuides, setOpenGuides] = useState<Record<string, boolean>>({});
  const [activeTemplate, setActiveTemplate] = useState<TemplateType>('unpaid');
  const [showPushSection, setShowPushSection] = useState(false);
  const [showSolapiSettingsSection, setShowSolapiSettingsSection] = useState(true);
  const [academyName, setAcademyName] = useState<string>('파카체대입시');

  // 발신번호 관리
  const [senderNumbers, setSenderNumbers] = useState<SenderNumber[]>([]);
  const [newSenderPhone, setNewSenderPhone] = useState('');
  const [newSenderLabel, setNewSenderLabel] = useState('');
  const [addingSender, setAddingSender] = useState(false);

  const loadSenderNumbers = useCallback(async () => {
    try {
      const { senderNumbers: numbers } = await smsAPI.getSenderNumbers(activeTab);
      setSenderNumbers(numbers);
    } catch {
      setSenderNumbers([]);
    }
  }, [activeTab]);

  useEffect(() => {
    loadSettings();
    loadLogs();
    loadAcademyName();
  }, []);

  useEffect(() => {
    loadSenderNumbers();
  }, [loadSenderNumbers]);

  const loadAcademyName = async () => {
    try {
      const response = await apiClient.get<{ settings: { academy_name?: string } }>('/settings/academy');
      if (response.settings?.academy_name) {
        setAcademyName(response.settings.academy_name);
      }
    } catch {
      // 실패 시 기본값 유지
    }
  };

  const handleAddSenderNumber = async () => {
    if (!newSenderPhone.trim()) {
      setMessage({ type: 'error', text: '발신번호를 입력해주세요.' });
      return;
    }
    setAddingSender(true);
    try {
      await smsAPI.addSenderNumber({
        serviceType: activeTab,
        phone: newSenderPhone.trim(),
        label: newSenderLabel.trim() || undefined
      });
      setNewSenderPhone('');
      setNewSenderLabel('');
      loadSenderNumbers();
      setMessage({ type: 'success', text: '발신번호가 추가되었습니다.' });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.message || '발신번호 추가에 실패했습니다.' });
    } finally {
      setAddingSender(false);
    }
  };

  const handleSetDefaultSender = async (id: number) => {
    try {
      await smsAPI.updateSenderNumber(id, { isDefault: true });
      loadSenderNumbers();
      setMessage({ type: 'success', text: '기본 발신번호가 변경되었습니다.' });
    } catch {
      setMessage({ type: 'error', text: '기본 발신번호 변경에 실패했습니다.' });
    }
  };

  const handleDeleteSenderNumber = async (id: number) => {
    if (!confirm('이 발신번호를 삭제하시겠습니까?')) return;
    try {
      await smsAPI.deleteSenderNumber(id);
      loadSenderNumbers();
      setMessage({ type: 'success', text: '발신번호가 삭제되었습니다.' });
    } catch {
      setMessage({ type: 'error', text: '발신번호 삭제에 실패했습니다.' });
    }
  };

  const loadSettings = async () => {
    try {
      const data = await notificationsAPI.getSettings();
      setSettings(data);
      setActiveTab(data.service_type || 'sens');
    } catch {
      // 설정 로드 실패 시 기본값 유지
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const data = await notificationsAPI.getLogs({ limit: 10 });
      setLogs(data.logs);
    } catch {
      // 로그 로드 실패 시 빈 배열 유지
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await notificationsAPI.saveSettings(settings);
      setMessage({ type: 'success', text: '설정이 저장되었습니다.' });
      loadSettings();
    } catch {
      setMessage({ type: 'error', text: '설정 저장에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const runNotificationTest = async (
    phone: string,
    setTestingState: (value: boolean) => void,
    send: () => Promise<unknown>,
    successText: string,
    fallbackErrorText: string
  ) => {
    if (!phone) {
      setMessage({ type: 'error', text: '테스트 전화번호를 입력해주세요.' });
      return;
    }
    setTestingState(true);
    setMessage(null);
    try {
      await send();
      setMessage({ type: 'success', text: successText });
      loadLogs();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.message || fallbackErrorText });
    } finally {
      setTestingState(false);
    }
  };

  const handleTest = () => runNotificationTest(
    testPhone,
    setTesting,
    () => notificationsAPI.sendTest(testPhone),
    '테스트 메시지가 발송되었습니다.',
    '테스트 발송에 실패했습니다.'
  );

  const addButton = (field: NotificationButtonField) => {
    setSettings(prev => appendNotificationButton(prev, field));
  };
  const removeButton = (field: NotificationButtonField, index: number) => {
    setSettings(prev => removeNotificationButton(prev, field, index));
  };
  const updateButton = (
    field: NotificationButtonField,
    index: number,
    buttonField: keyof ConsultationButton,
    value: string
  ) => {
    setSettings(prev => updateNotificationButton(prev, field, index, buttonField, value));
  };

  const addUnpaidButton = () => addButton('solapi_buttons');
  const removeUnpaidButton = (index: number) => removeButton('solapi_buttons', index);
  const updateUnpaidButton = (index: number, field: keyof ConsultationButton, value: string) => {
    updateButton('solapi_buttons', index, field, value);
  };

  const addConsultationButton = () => addButton('solapi_consultation_buttons');
  const removeConsultationButton = (index: number) => removeButton('solapi_consultation_buttons', index);
  const updateConsultationButton = (index: number, field: keyof ConsultationButton, value: string) => {
    updateButton('solapi_consultation_buttons', index, field, value);
  };

  const addTrialButton = () => addButton('solapi_trial_buttons');
  const removeTrialButton = (index: number) => removeButton('solapi_trial_buttons', index);
  const updateTrialButton = (index: number, field: keyof ConsultationButton, value: string) => {
    updateButton('solapi_trial_buttons', index, field, value);
  };

  const addOverdueButton = () => addButton('solapi_overdue_buttons');
  const removeOverdueButton = (index: number) => removeButton('solapi_overdue_buttons', index);
  const updateOverdueButton = (index: number, field: keyof ConsultationButton, value: string) => {
    updateButton('solapi_overdue_buttons', index, field, value);
  };

  const addReminderButton = () => addButton('solapi_reminder_buttons');
  const removeReminderButton = (index: number) => removeButton('solapi_reminder_buttons', index);
  const updateReminderButton = (index: number, field: keyof ConsultationButton, value: string) => {
    updateButton('solapi_reminder_buttons', index, field, value);
  };

  const handleTestConsultation = () => runNotificationTest(testPhoneConsultation, setTestingConsultation, () => notificationsAPI.sendTestConsultation(testPhoneConsultation), '상담확정 테스트 메시지가 발송되었습니다.', '상담확정 테스트 발송에 실패했습니다.');
  const handleTestTrial = () => runNotificationTest(testPhoneTrial, setTestingTrial, () => notificationsAPI.sendTestTrial(testPhoneTrial), '체험수업 테스트 메시지가 발송되었습니다.', '체험수업 테스트 발송에 실패했습니다.');
  const handleTestOverdue = () => runNotificationTest(testPhoneOverdue, setTestingOverdue, () => notificationsAPI.sendTestOverdue(testPhoneOverdue), '미납자 테스트 메시지가 발송되었습니다.', '미납자 테스트 발송에 실패했습니다.');
  const handleTestReminder = () => runNotificationTest(testPhoneReminder, setTestingReminder, () => notificationsAPI.sendTestReminder(testPhoneReminder), '상담 리마인드 테스트 메시지가 발송되었습니다.', '상담 리마인드 테스트 발송에 실패했습니다.');

  const addSensUnpaidButton = () => addButton('sens_buttons');
  const removeSensUnpaidButton = (index: number) => removeButton('sens_buttons', index);
  const updateSensUnpaidButton = (index: number, field: keyof ConsultationButton, value: string) => {
    updateButton('sens_buttons', index, field, value);
  };

  const addSensConsultationButton = () => addButton('sens_consultation_buttons');
  const removeSensConsultationButton = (index: number) => removeButton('sens_consultation_buttons', index);
  const updateSensConsultationButton = (index: number, field: keyof ConsultationButton, value: string) => {
    updateButton('sens_consultation_buttons', index, field, value);
  };

  const addSensTrialButton = () => addButton('sens_trial_buttons');
  const removeSensTrialButton = (index: number) => removeButton('sens_trial_buttons', index);
  const updateSensTrialButton = (index: number, field: keyof ConsultationButton, value: string) => {
    updateButton('sens_trial_buttons', index, field, value);
  };

  const addSensOverdueButton = () => addButton('sens_overdue_buttons');
  const removeSensOverdueButton = (index: number) => removeButton('sens_overdue_buttons', index);
  const updateSensOverdueButton = (index: number, field: keyof ConsultationButton, value: string) => {
    updateButton('sens_overdue_buttons', index, field, value);
  };

  const addSensReminderButton = () => addButton('sens_reminder_buttons');
  const removeSensReminderButton = (index: number) => removeButton('sens_reminder_buttons', index);
  const updateSensReminderButton = (index: number, field: keyof ConsultationButton, value: string) => {
    updateButton('sens_reminder_buttons', index, field, value);
  };

  const handleTestSensConsultation = () => runNotificationTest(testPhoneSensConsultation, setTestingSensConsultation, () => notificationsAPI.sendTestSensConsultation(testPhoneSensConsultation), 'SENS 상담확정 테스트 메시지가 발송되었습니다.', 'SENS 상담확정 테스트 발송에 실패했습니다.');
  const handleTestSensTrial = () => runNotificationTest(testPhoneSensTrial, setTestingSensTrial, () => notificationsAPI.sendTestSensTrial(testPhoneSensTrial), 'SENS 체험수업 테스트 메시지가 발송되었습니다.', 'SENS 체험수업 테스트 발송에 실패했습니다.');
  const handleTestSensOverdue = () => runNotificationTest(testPhoneSensOverdue, setTestingSensOverdue, () => notificationsAPI.sendTestSensOverdue(testPhoneSensOverdue), 'SENS 미납자 테스트 메시지가 발송되었습니다.', 'SENS 미납자 테스트 발송에 실패했습니다.');
  const handleTestSensReminder = () => runNotificationTest(testPhoneSensReminder, setTestingSensReminder, () => notificationsAPI.sendTestSensReminder(testPhoneSensReminder), 'SENS 상담 리마인드 테스트 메시지가 발송되었습니다.', 'SENS 상담 리마인드 테스트 발송에 실패했습니다.');

  // 미납자 수동 발송
  const handleSendUnpaid = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    if (!confirm(`${year}년 ${month}월 미납자에게 알림톡을 발송하시겠습니까?`)) {
      return;
    }

    setSendingUnpaid(true);
    setMessage(null);
    try {
      const result = await notificationsAPI.sendUnpaid(year, month);
      setMessage({
        type: 'success',
        text: `발송 완료: ${result.sent}명 성공, ${result.failed}명 실패`
      });
      loadLogs();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.message || '발송에 실패했습니다.' });
    } finally {
      setSendingUnpaid(false);
    }
  };

  const toggleGuide = (key: string) => {
    setOpenGuides(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleServiceTypeChange = (type: ServiceType) => {
    setActiveTab(type);
    setSettings(prev => ({ ...prev, service_type: type }));
  };

  return {
    // state
    settings, setSettings,
    activeTab, activeSensTemplate, setActiveSensTemplate,
    logs,
    loading,
    saving,
    testing, testingConsultation, testingTrial, testingOverdue,
    testingSensConsultation, testingSensTrial, testingSensOverdue, testingSensReminder,
    testingReminder,
    testPhone, setTestPhone,
    testPhoneConsultation, setTestPhoneConsultation,
    testPhoneTrial, setTestPhoneTrial,
    testPhoneOverdue, setTestPhoneOverdue,
    testPhoneReminder, setTestPhoneReminder,
    testPhoneSensConsultation, setTestPhoneSensConsultation,
    testPhoneSensTrial, setTestPhoneSensTrial,
    testPhoneSensOverdue, setTestPhoneSensOverdue,
    testPhoneSensReminder, setTestPhoneSensReminder,
    message,
    sendingUnpaid,
    showPriceModal, setShowPriceModal,
    openGuides,
    activeTemplate, setActiveTemplate,
    showPushSection, setShowPushSection,
    showSolapiSettingsSection, setShowSolapiSettingsSection,
    academyName,
    senderNumbers,
    newSenderPhone, setNewSenderPhone,
    newSenderLabel, setNewSenderLabel,
    addingSender,
    // handlers
    handleSave,
    handleTest,
    handleTestConsultation,
    handleTestTrial,
    handleTestOverdue,
    handleTestReminder,
    handleTestSensConsultation,
    handleTestSensTrial,
    handleTestSensOverdue,
    handleTestSensReminder,
    handleSendUnpaid,
    handleServiceTypeChange,
    handleAddSenderNumber,
    handleSetDefaultSender,
    handleDeleteSenderNumber,
    toggleGuide,
    // solapi button handlers
    addUnpaidButton, removeUnpaidButton, updateUnpaidButton,
    addConsultationButton, removeConsultationButton, updateConsultationButton,
    addTrialButton, removeTrialButton, updateTrialButton,
    addOverdueButton, removeOverdueButton, updateOverdueButton,
    addReminderButton, removeReminderButton, updateReminderButton,
    // SENS button handlers
    addSensUnpaidButton, removeSensUnpaidButton, updateSensUnpaidButton,
    addSensConsultationButton, removeSensConsultationButton, updateSensConsultationButton,
    addSensTrialButton, removeSensTrialButton, updateSensTrialButton,
    addSensOverdueButton, removeSensOverdueButton, updateSensOverdueButton,
    addSensReminderButton, removeSensReminderButton, updateSensReminderButton,
    // derived
    loadLogs,
  };
}
