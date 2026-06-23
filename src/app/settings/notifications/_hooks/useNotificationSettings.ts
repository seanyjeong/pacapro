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
import {
  getNotificationErrorText,
  NOTIFICATION_LOAD_ERROR_MESSAGES,
  type NotificationLoadErrorKey,
  type NotificationLoadErrors,
  SILENT_CONFIG,
} from './notification-error-utils';

export type NotificationPendingConfirmation =
  | { kind: 'sender-delete'; senderId: number; phone: string }
  | { kind: 'unpaid-send'; year: number; month: number };

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(() => createDefaultNotificationSettings());

  const [activeTab, setActiveTab] = useState<ServiceType>('sens');
  const [activeSensTemplate, setActiveSensTemplate] = useState<TemplateType>('unpaid');
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loadErrors, setLoadErrors] = useState<NotificationLoadErrors>({});
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
  const [testingSensAttendance, setTestingSensAttendance] = useState(false);
  // 솔라피 리마인드 테스트 상태
  const [testingReminder, setTestingReminder] = useState(false);
  const [testingAttendance, setTestingAttendance] = useState(false);
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
  const [testPhoneSensAttendance, setTestPhoneSensAttendance] = useState('');
  const [testPhoneAttendance, setTestPhoneAttendance] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sendingUnpaid, setSendingUnpaid] = useState(false);
  const [deletingSenderId, setDeletingSenderId] = useState<number | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<NotificationPendingConfirmation | null>(null);

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

  const setLoadError = useCallback((key: NotificationLoadErrorKey, message?: string) => {
    setLoadErrors(prev => {
      const next = { ...prev };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });
  }, []);

  const loadSenderNumbers = useCallback(async () => {
    setLoadError('senderNumbers');
    try {
      const { senderNumbers: numbers } = await smsAPI.getSenderNumbers(activeTab, SILENT_CONFIG);
      setSenderNumbers(numbers);
    } catch {
      setSenderNumbers([]);
      setLoadError('senderNumbers', NOTIFICATION_LOAD_ERROR_MESSAGES.senderNumbers);
    }
  }, [activeTab, setLoadError]);

  const loadAcademyName = useCallback(async () => {
    setLoadError('academy');
    try {
      const response = await apiClient.get<{ settings: { academy_name?: string } }>('/settings/academy', SILENT_CONFIG);
      if (response.settings?.academy_name) {
        setAcademyName(response.settings.academy_name);
      }
    } catch {
      setLoadError('academy', NOTIFICATION_LOAD_ERROR_MESSAGES.academy);
    }
  }, [setLoadError]);

  const loadSettings = useCallback(async () => {
    setLoadError('settings');
    try {
      const data = await notificationsAPI.getSettings(SILENT_CONFIG);
      setSettings(data);
      setActiveTab(data.service_type || 'sens');
    } catch {
      setLoadError('settings', NOTIFICATION_LOAD_ERROR_MESSAGES.settings);
    } finally {
      setLoading(false);
    }
  }, [setLoadError]);

  const loadLogs = useCallback(async () => {
    setLoadError('logs');
    try {
      const data = await notificationsAPI.getLogs({ limit: 10 }, SILENT_CONFIG);
      setLogs(data.logs);
    } catch {
      setLogs([]);
      setLoadError('logs', NOTIFICATION_LOAD_ERROR_MESSAGES.logs);
    }
  }, [setLoadError]);

  useEffect(() => {
    loadSettings();
    loadLogs();
    loadAcademyName();
  }, [loadAcademyName, loadLogs, loadSettings]);

  useEffect(() => {
    loadSenderNumbers();
  }, [loadSenderNumbers]);

  useEffect(() => {
    if (loading) return;

    const params = new URLSearchParams(window.location.search);
    const service = params.get('service');
    const template = params.get('template');
    const validTemplate = template === 'unpaid'
      || template === 'consultation'
      || template === 'trial'
      || template === 'overdue'
      || template === 'reminder'
      || template === 'attendance';

    if (service === 'sens' || service === 'solapi') {
      setActiveTab(service);
      setSettings(prev => (prev.service_type === service ? prev : { ...prev, service_type: service }));
    }
    if (validTemplate) {
      setActiveTemplate(template);
      setActiveSensTemplate(template);
    }
  }, [loading]);

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
      }, SILENT_CONFIG);
      setNewSenderPhone('');
      setNewSenderLabel('');
      loadSenderNumbers();
      setMessage({ type: 'success', text: '발신번호가 추가되었습니다.' });
    } catch (error: unknown) {
      setMessage({ type: 'error', text: getNotificationErrorText(error, '발신번호 추가에 실패했습니다.') });
    } finally {
      setAddingSender(false);
    }
  };

  const handleSetDefaultSender = async (id: number) => {
    try {
      await smsAPI.updateSenderNumber(id, { isDefault: true }, SILENT_CONFIG);
      loadSenderNumbers();
      setMessage({ type: 'success', text: '기본 발신번호가 변경되었습니다.' });
    } catch {
      setMessage({ type: 'error', text: '기본 발신번호 변경에 실패했습니다.' });
    }
  };

  const handleDeleteSenderNumber = (id: number) => {
    const sender = senderNumbers.find(item => item.id === id);
    setPendingConfirmation({
      kind: 'sender-delete',
      senderId: id,
      phone: sender?.phone || '선택한',
    });
  };

  const confirmDeleteSenderNumber = async (id: number): Promise<boolean> => {
    setDeletingSenderId(id);
    setMessage(null);
    try {
      await smsAPI.deleteSenderNumber(id, SILENT_CONFIG);
      loadSenderNumbers();
      setMessage({ type: 'success', text: '발신번호가 삭제되었습니다.' });
      return true;
    } catch {
      setMessage({ type: 'error', text: '발신번호 삭제에 실패했습니다.' });
      return false;
    } finally {
      setDeletingSenderId(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await notificationsAPI.saveSettings(settings, SILENT_CONFIG);
      setMessage({ type: 'success', text: '설정이 저장되었습니다.' });
      loadSettings();
    } catch {
      setMessage({ type: 'error', text: '설정 저장에 실패했습니다. 입력값을 확인한 뒤 다시 시도해주세요.' });
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
      setMessage({ type: 'error', text: getNotificationErrorText(error, fallbackErrorText) });
    } finally {
      setTestingState(false);
    }
  };

  const handleTest = () => runNotificationTest(
    testPhone,
    setTesting,
    () => notificationsAPI.sendTest(testPhone, SILENT_CONFIG),
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

  const handleTestConsultation = () => runNotificationTest(testPhoneConsultation, setTestingConsultation, () => notificationsAPI.sendTestConsultation(testPhoneConsultation, SILENT_CONFIG), '상담확정 테스트 메시지가 발송되었습니다.', '상담확정 테스트 발송에 실패했습니다.');
  const handleTestTrial = () => runNotificationTest(testPhoneTrial, setTestingTrial, () => notificationsAPI.sendTestTrial(testPhoneTrial, SILENT_CONFIG), '체험수업 테스트 메시지가 발송되었습니다.', '체험수업 테스트 발송에 실패했습니다.');
  const handleTestOverdue = () => runNotificationTest(testPhoneOverdue, setTestingOverdue, () => notificationsAPI.sendTestOverdue(testPhoneOverdue, SILENT_CONFIG), '미납자 테스트 메시지가 발송되었습니다.', '미납자 테스트 발송에 실패했습니다.');
  const handleTestReminder = () => runNotificationTest(testPhoneReminder, setTestingReminder, () => notificationsAPI.sendTestReminder(testPhoneReminder, SILENT_CONFIG), '상담 리마인드 테스트 메시지가 발송되었습니다.', '상담 리마인드 테스트 발송에 실패했습니다.');
  const handleTestAttendance = () => runNotificationTest(testPhoneAttendance, setTestingAttendance, () => notificationsAPI.sendTestAttendance(testPhoneAttendance, SILENT_CONFIG), '출결관리 테스트 메시지가 발송되었습니다.', '출결관리 테스트 발송에 실패했습니다.');

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

  const handleTestSensConsultation = () => runNotificationTest(testPhoneSensConsultation, setTestingSensConsultation, () => notificationsAPI.sendTestSensConsultation(testPhoneSensConsultation, SILENT_CONFIG), 'SENS 상담확정 테스트 메시지가 발송되었습니다.', 'SENS 상담확정 테스트 발송에 실패했습니다.');
  const handleTestSensTrial = () => runNotificationTest(testPhoneSensTrial, setTestingSensTrial, () => notificationsAPI.sendTestSensTrial(testPhoneSensTrial, SILENT_CONFIG), 'SENS 체험수업 테스트 메시지가 발송되었습니다.', 'SENS 체험수업 테스트 발송에 실패했습니다.');
  const handleTestSensOverdue = () => runNotificationTest(testPhoneSensOverdue, setTestingSensOverdue, () => notificationsAPI.sendTestSensOverdue(testPhoneSensOverdue, SILENT_CONFIG), 'SENS 미납자 테스트 메시지가 발송되었습니다.', 'SENS 미납자 테스트 발송에 실패했습니다.');
  const handleTestSensReminder = () => runNotificationTest(testPhoneSensReminder, setTestingSensReminder, () => notificationsAPI.sendTestSensReminder(testPhoneSensReminder, SILENT_CONFIG), 'SENS 상담 리마인드 테스트 메시지가 발송되었습니다.', 'SENS 상담 리마인드 테스트 발송에 실패했습니다.');
  const handleTestSensAttendance = () => runNotificationTest(testPhoneSensAttendance, setTestingSensAttendance, () => notificationsAPI.sendTestSensAttendance(testPhoneSensAttendance, SILENT_CONFIG), 'SENS 출결관리 테스트 메시지가 발송되었습니다.', 'SENS 출결관리 테스트 발송에 실패했습니다.');

  // 미납자 수동 발송
  const handleSendUnpaid = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    setPendingConfirmation({ kind: 'unpaid-send', year, month });
  };

  const confirmSendUnpaid = async (year: number, month: number): Promise<boolean> => {
    setSendingUnpaid(true);
    setMessage(null);
    try {
      const result = await notificationsAPI.sendUnpaid(year, month, SILENT_CONFIG);
      setMessage({
        type: 'success',
        text: `발송 완료: ${result.sent}명 성공, ${result.failed}명 실패`
      });
      loadLogs();
      return true;
    } catch (error: unknown) {
      setMessage({ type: 'error', text: getNotificationErrorText(error, '발송에 실패했습니다. 잠시 후 다시 시도해주세요.') });
      return false;
    } finally {
      setSendingUnpaid(false);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingConfirmation) return;

    if (pendingConfirmation.kind === 'sender-delete') {
      const ok = await confirmDeleteSenderNumber(pendingConfirmation.senderId);
      if (ok) setPendingConfirmation(null);
      return;
    }

    const ok = await confirmSendUnpaid(pendingConfirmation.year, pendingConfirmation.month);
    if (ok) setPendingConfirmation(null);
  };

  const handlePendingConfirmationOpenChange = (open: boolean) => {
    if (open || deletingSenderId !== null || sendingUnpaid) return;
    setPendingConfirmation(null);
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
    loadErrors: Object.values(loadErrors),
    loading,
    saving,
    testing, testingConsultation, testingTrial, testingOverdue,
    testingSensConsultation, testingSensTrial, testingSensOverdue, testingSensReminder, testingSensAttendance,
    testingReminder, testingAttendance,
    testPhone, setTestPhone,
    testPhoneConsultation, setTestPhoneConsultation,
    testPhoneTrial, setTestPhoneTrial,
    testPhoneOverdue, setTestPhoneOverdue,
    testPhoneReminder, setTestPhoneReminder,
    testPhoneSensConsultation, setTestPhoneSensConsultation,
    testPhoneSensTrial, setTestPhoneSensTrial,
    testPhoneSensOverdue, setTestPhoneSensOverdue,
    testPhoneSensReminder, setTestPhoneSensReminder,
    testPhoneSensAttendance, setTestPhoneSensAttendance,
    testPhoneAttendance, setTestPhoneAttendance,
    message,
    sendingUnpaid,
    deletingSenderId,
    pendingConfirmation,
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
    handleTestAttendance,
    handleTestSensConsultation,
    handleTestSensTrial,
    handleTestSensOverdue,
    handleTestSensReminder,
    handleTestSensAttendance,
    handleSendUnpaid,
    handleServiceTypeChange,
    handleAddSenderNumber,
    handleSetDefaultSender,
    handleDeleteSenderNumber,
    confirmPendingAction,
    handlePendingConfirmationOpenChange,
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
