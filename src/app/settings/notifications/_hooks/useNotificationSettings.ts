'use client';

// Phase 4 #1 — notifications/page.tsx 분리 (ADR-017)
// 모든 state + handler + API 호출을 이 hook으로 추출
// props 전달: page.tsx → sub-components

import { useState, useEffect } from 'react';
import { notificationsAPI, NotificationSettings, NotificationLog, ConsultationButton } from '@/lib/api/notifications';
import apiClient from '@/lib/api/client';
import { smsAPI } from '@/lib/api/sms';
import { SenderNumber, ServiceType, TemplateType } from '../_types';

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>({
    service_type: 'sens',
    // ===== SENS 설정 =====
    naver_access_key: '',
    naver_secret_key: '',
    naver_service_id: '',
    sms_service_id: '',
    kakao_channel_id: '',
    // SENS 납부안내
    template_code: '',
    template_content: '',
    sens_buttons: [],
    sens_image_url: '',
    sens_auto_enabled: false,
    sens_auto_hour: 10,
    // SENS 상담확정
    sens_consultation_template_code: '',
    sens_consultation_template_content: '',
    sens_consultation_buttons: [],
    sens_consultation_image_url: '',
    // SENS 체험수업
    sens_trial_template_code: '',
    sens_trial_template_content: '',
    sens_trial_buttons: [],
    sens_trial_image_url: '',
    sens_trial_auto_enabled: false,
    sens_trial_auto_hour: 9,
    // SENS 미납자
    sens_overdue_template_code: '',
    sens_overdue_template_content: '',
    sens_overdue_buttons: [],
    sens_overdue_image_url: '',
    sens_overdue_auto_enabled: false,
    sens_overdue_auto_hour: 9,
    // SENS 상담 리마인드
    sens_reminder_template_code: '',
    sens_reminder_template_content: '',
    sens_reminder_buttons: [],
    sens_reminder_image_url: '',
    sens_reminder_auto_enabled: false,
    sens_reminder_hours: 1,
    // ===== 솔라피 설정 =====
    solapi_api_key: '',
    solapi_api_secret: '',
    solapi_pfid: '',
    solapi_sender_phone: '',
    // 솔라피 납부안내
    solapi_template_id: '',
    solapi_template_content: '',
    solapi_buttons: [],
    solapi_image_url: '',
    solapi_auto_enabled: false,
    solapi_auto_hour: 10,
    // 솔라피 상담확정
    solapi_consultation_template_id: '',
    solapi_consultation_template_content: '',
    solapi_consultation_buttons: [],
    solapi_consultation_image_url: '',
    // 솔라피 체험수업
    solapi_trial_template_id: '',
    solapi_trial_template_content: '',
    solapi_trial_buttons: [],
    solapi_trial_image_url: '',
    solapi_trial_auto_enabled: false,
    solapi_trial_auto_hour: 9,
    // 솔라피 미납자
    solapi_overdue_template_id: '',
    solapi_overdue_template_content: '',
    solapi_overdue_buttons: [],
    solapi_overdue_image_url: '',
    solapi_overdue_auto_enabled: false,
    solapi_overdue_auto_hour: 9,
    // 솔라피 상담 리마인드
    solapi_reminder_template_id: '',
    solapi_reminder_template_content: '',
    solapi_reminder_buttons: [],
    solapi_reminder_image_url: '',
    solapi_reminder_auto_enabled: false,
    solapi_reminder_hours: 1,
    // 솔라피 출결관리
    solapi_attendance_template_id: '',
    solapi_attendance_template_content: '',
    solapi_attendance_buttons: [],
    solapi_attendance_image_url: '',
    // SENS 출결관리
    sens_attendance_template_code: '',
    sens_attendance_template_content: '',
    sens_attendance_buttons: [],
    sens_attendance_image_url: '',
    // ===== 공통 설정 =====
    is_enabled: false,
    solapi_enabled: false,
    attendance_alimtalk_enabled: false,
  });

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
  // 출결 테스트 상태
  const [testingAttendance, setTestingAttendance] = useState(false);
  const [testingSensAttendance, setTestingSensAttendance] = useState(false);
  const [testPhoneAttendance, setTestPhoneAttendance] = useState('');
  const [testPhoneSensAttendance, setTestPhoneSensAttendance] = useState('');
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

  useEffect(() => {
    loadSettings();
    loadLogs();
    loadAcademyName();
  }, []);

  useEffect(() => {
    loadSenderNumbers();
  }, [activeTab]);

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

  const loadSenderNumbers = async () => {
    try {
      const { senderNumbers: numbers } = await smsAPI.getSenderNumbers(activeTab);
      setSenderNumbers(numbers);
    } catch {
      setSenderNumbers([]);
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

  const handleTest = async () => {
    if (!testPhone) {
      setMessage({ type: 'error', text: '테스트 전화번호를 입력해주세요.' });
      return;
    }
    setTesting(true);
    setMessage(null);
    try {
      await notificationsAPI.sendTest(testPhone);
      setMessage({ type: 'success', text: '테스트 메시지가 발송되었습니다.' });
      loadLogs();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.message || '테스트 발송에 실패했습니다.' });
    } finally {
      setTesting(false);
    }
  };

  // 납부 안내 버튼
  const addUnpaidButton = () => {
    const newButton: ConsultationButton = { buttonType: 'WL', buttonName: '', linkMo: '', linkPc: '' };
    setSettings(prev => ({ ...prev, solapi_buttons: [...(prev.solapi_buttons || []), newButton] }));
  };
  const removeUnpaidButton = (index: number) => {
    setSettings(prev => ({ ...prev, solapi_buttons: prev.solapi_buttons.filter((_, i) => i !== index) }));
  };
  const updateUnpaidButton = (index: number, field: keyof ConsultationButton, value: string) => {
    setSettings(prev => ({
      ...prev,
      solapi_buttons: prev.solapi_buttons.map((btn, i) => i === index ? { ...btn, [field]: value } : btn),
    }));
  };

  // 상담확정 버튼
  const addConsultationButton = () => {
    const newButton: ConsultationButton = { buttonType: 'WL', buttonName: '', linkMo: '', linkPc: '' };
    setSettings(prev => ({ ...prev, solapi_consultation_buttons: [...(prev.solapi_consultation_buttons || []), newButton] }));
  };
  const removeConsultationButton = (index: number) => {
    setSettings(prev => ({ ...prev, solapi_consultation_buttons: prev.solapi_consultation_buttons.filter((_, i) => i !== index) }));
  };
  const updateConsultationButton = (index: number, field: keyof ConsultationButton, value: string) => {
    setSettings(prev => ({
      ...prev,
      solapi_consultation_buttons: prev.solapi_consultation_buttons.map((btn, i) => i === index ? { ...btn, [field]: value } : btn),
    }));
  };

  // 상담확정 알림톡 테스트
  const handleTestConsultation = async () => {
    if (!testPhoneConsultation) {
      setMessage({ type: 'error', text: '테스트 전화번호를 입력해주세요.' });
      return;
    }
    setTestingConsultation(true);
    setMessage(null);
    try {
      await notificationsAPI.sendTestConsultation(testPhoneConsultation);
      setMessage({ type: 'success', text: '상담확정 테스트 메시지가 발송되었습니다.' });
      loadLogs();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.message || '상담확정 테스트 발송에 실패했습니다.' });
    } finally {
      setTestingConsultation(false);
    }
  };

  // 체험수업 알림톡 테스트
  const handleTestTrial = async () => {
    if (!testPhoneTrial) {
      setMessage({ type: 'error', text: '테스트 전화번호를 입력해주세요.' });
      return;
    }
    setTestingTrial(true);
    setMessage(null);
    try {
      await notificationsAPI.sendTestTrial(testPhoneTrial);
      setMessage({ type: 'success', text: '체험수업 테스트 메시지가 발송되었습니다.' });
      loadLogs();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.message || '체험수업 테스트 발송에 실패했습니다.' });
    } finally {
      setTestingTrial(false);
    }
  };

  // 미납자 알림톡 테스트
  const handleTestOverdue = async () => {
    if (!testPhoneOverdue) {
      setMessage({ type: 'error', text: '테스트 전화번호를 입력해주세요.' });
      return;
    }
    setTestingOverdue(true);
    setMessage(null);
    try {
      await notificationsAPI.sendTestOverdue(testPhoneOverdue);
      setMessage({ type: 'success', text: '미납자 테스트 메시지가 발송되었습니다.' });
      loadLogs();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.message || '미납자 테스트 발송에 실패했습니다.' });
    } finally {
      setTestingOverdue(false);
    }
  };

  const handleTestReminder = async () => {
    if (!testPhoneReminder) {
      setMessage({ type: 'error', text: '테스트 전화번호를 입력해주세요.' });
      return;
    }
    setTestingReminder(true);
    setMessage(null);
    try {
      await notificationsAPI.sendTestReminder(testPhoneReminder);
      setMessage({ type: 'success', text: '상담 리마인드 테스트 메시지가 발송되었습니다.' });
      loadLogs();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.message || '상담 리마인드 테스트 발송에 실패했습니다.' });
    } finally {
      setTestingReminder(false);
    }
  };

  // 체험수업 버튼
  const addTrialButton = () => {
    const newButton: ConsultationButton = { buttonType: 'WL', buttonName: '', linkMo: '', linkPc: '' };
    setSettings(prev => ({ ...prev, solapi_trial_buttons: [...(prev.solapi_trial_buttons || []), newButton] }));
  };
  const removeTrialButton = (index: number) => {
    setSettings(prev => ({ ...prev, solapi_trial_buttons: prev.solapi_trial_buttons.filter((_, i) => i !== index) }));
  };
  const updateTrialButton = (index: number, field: keyof ConsultationButton, value: string) => {
    setSettings(prev => ({
      ...prev,
      solapi_trial_buttons: prev.solapi_trial_buttons.map((btn, i) => i === index ? { ...btn, [field]: value } : btn),
    }));
  };

  // 미납자 버튼
  const addOverdueButton = () => {
    const newButton: ConsultationButton = { buttonType: 'WL', buttonName: '', linkMo: '', linkPc: '' };
    setSettings(prev => ({ ...prev, solapi_overdue_buttons: [...(prev.solapi_overdue_buttons || []), newButton] }));
  };
  const removeOverdueButton = (index: number) => {
    setSettings(prev => ({ ...prev, solapi_overdue_buttons: prev.solapi_overdue_buttons.filter((_, i) => i !== index) }));
  };
  const updateOverdueButton = (index: number, field: keyof ConsultationButton, value: string) => {
    setSettings(prev => ({
      ...prev,
      solapi_overdue_buttons: prev.solapi_overdue_buttons.map((btn, i) => i === index ? { ...btn, [field]: value } : btn),
    }));
  };

  // 솔라피 리마인드 버튼
  const addReminderButton = () => {
    const newButton: ConsultationButton = { buttonType: 'WL', buttonName: '', linkMo: '', linkPc: '' };
    setSettings(prev => ({ ...prev, solapi_reminder_buttons: [...(prev.solapi_reminder_buttons || []), newButton] }));
  };
  const removeReminderButton = (index: number) => {
    setSettings(prev => ({ ...prev, solapi_reminder_buttons: prev.solapi_reminder_buttons.filter((_, i) => i !== index) }));
  };
  const updateReminderButton = (index: number, field: keyof ConsultationButton, value: string) => {
    setSettings(prev => ({
      ...prev,
      solapi_reminder_buttons: prev.solapi_reminder_buttons.map((btn, i) => i === index ? { ...btn, [field]: value } : btn),
    }));
  };

  // ===== SENS 버튼 관리 =====
  const addSensUnpaidButton = () => {
    const newButton: ConsultationButton = { buttonType: 'WL', buttonName: '', linkMo: '', linkPc: '' };
    setSettings(prev => ({ ...prev, sens_buttons: [...(prev.sens_buttons || []), newButton] }));
  };
  const removeSensUnpaidButton = (index: number) => {
    setSettings(prev => ({ ...prev, sens_buttons: prev.sens_buttons.filter((_, i) => i !== index) }));
  };
  const updateSensUnpaidButton = (index: number, field: keyof ConsultationButton, value: string) => {
    setSettings(prev => ({
      ...prev,
      sens_buttons: prev.sens_buttons.map((btn, i) => i === index ? { ...btn, [field]: value } : btn),
    }));
  };

  const addSensConsultationButton = () => {
    const newButton: ConsultationButton = { buttonType: 'WL', buttonName: '', linkMo: '', linkPc: '' };
    setSettings(prev => ({ ...prev, sens_consultation_buttons: [...(prev.sens_consultation_buttons || []), newButton] }));
  };
  const removeSensConsultationButton = (index: number) => {
    setSettings(prev => ({ ...prev, sens_consultation_buttons: prev.sens_consultation_buttons.filter((_, i) => i !== index) }));
  };
  const updateSensConsultationButton = (index: number, field: keyof ConsultationButton, value: string) => {
    setSettings(prev => ({
      ...prev,
      sens_consultation_buttons: prev.sens_consultation_buttons.map((btn, i) => i === index ? { ...btn, [field]: value } : btn),
    }));
  };

  const addSensTrialButton = () => {
    const newButton: ConsultationButton = { buttonType: 'WL', buttonName: '', linkMo: '', linkPc: '' };
    setSettings(prev => ({ ...prev, sens_trial_buttons: [...(prev.sens_trial_buttons || []), newButton] }));
  };
  const removeSensTrialButton = (index: number) => {
    setSettings(prev => ({ ...prev, sens_trial_buttons: prev.sens_trial_buttons.filter((_, i) => i !== index) }));
  };
  const updateSensTrialButton = (index: number, field: keyof ConsultationButton, value: string) => {
    setSettings(prev => ({
      ...prev,
      sens_trial_buttons: prev.sens_trial_buttons.map((btn, i) => i === index ? { ...btn, [field]: value } : btn),
    }));
  };

  const addSensOverdueButton = () => {
    const newButton: ConsultationButton = { buttonType: 'WL', buttonName: '', linkMo: '', linkPc: '' };
    setSettings(prev => ({ ...prev, sens_overdue_buttons: [...(prev.sens_overdue_buttons || []), newButton] }));
  };
  const removeSensOverdueButton = (index: number) => {
    setSettings(prev => ({ ...prev, sens_overdue_buttons: prev.sens_overdue_buttons.filter((_, i) => i !== index) }));
  };
  const updateSensOverdueButton = (index: number, field: keyof ConsultationButton, value: string) => {
    setSettings(prev => ({
      ...prev,
      sens_overdue_buttons: prev.sens_overdue_buttons.map((btn, i) => i === index ? { ...btn, [field]: value } : btn),
    }));
  };

  const addSensReminderButton = () => {
    const newButton: ConsultationButton = { buttonType: 'WL', buttonName: '', linkMo: '', linkPc: '' };
    setSettings(prev => ({ ...prev, sens_reminder_buttons: [...(prev.sens_reminder_buttons || []), newButton] }));
  };
  const removeSensReminderButton = (index: number) => {
    setSettings(prev => ({ ...prev, sens_reminder_buttons: prev.sens_reminder_buttons.filter((_, i) => i !== index) }));
  };
  const updateSensReminderButton = (index: number, field: keyof ConsultationButton, value: string) => {
    setSettings(prev => ({
      ...prev,
      sens_reminder_buttons: prev.sens_reminder_buttons.map((btn, i) => i === index ? { ...btn, [field]: value } : btn),
    }));
  };

  // ===== SENS 테스트 발송 =====
  const handleTestSensConsultation = async () => {
    if (!testPhoneSensConsultation) {
      setMessage({ type: 'error', text: '테스트 전화번호를 입력해주세요.' });
      return;
    }
    setTestingSensConsultation(true);
    setMessage(null);
    try {
      await notificationsAPI.sendTestSensConsultation(testPhoneSensConsultation);
      setMessage({ type: 'success', text: 'SENS 상담확정 테스트 메시지가 발송되었습니다.' });
      loadLogs();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.message || 'SENS 상담확정 테스트 발송에 실패했습니다.' });
    } finally {
      setTestingSensConsultation(false);
    }
  };

  const handleTestAttendance = async () => {
    if (!testPhoneAttendance) {
      setMessage({ type: 'error', text: '테스트 전화번호를 입력해주세요.' });
      return;
    }
    setTestingAttendance(true);
    setMessage(null);
    try {
      await notificationsAPI.sendTestAttendance(testPhoneAttendance);
      setMessage({ type: 'success', text: '출결 테스트 메시지가 발송되었습니다.' });
      loadLogs();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.message || '출결 테스트 발송에 실패했습니다.' });
    } finally {
      setTestingAttendance(false);
    }
  };

  const handleTestSensAttendance = async () => {
    if (!testPhoneSensAttendance) {
      setMessage({ type: 'error', text: '테스트 전화번호를 입력해주세요.' });
      return;
    }
    setTestingSensAttendance(true);
    setMessage(null);
    try {
      await notificationsAPI.sendTestSensAttendance(testPhoneSensAttendance);
      setMessage({ type: 'success', text: 'SENS 출결 테스트 메시지가 발송되었습니다.' });
      loadLogs();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.message || 'SENS 출결 테스트 발송에 실패했습니다.' });
    } finally {
      setTestingSensAttendance(false);
    }
  };

  const handleTestSensTrial = async () => {
    if (!testPhoneSensTrial) {
      setMessage({ type: 'error', text: '테스트 전화번호를 입력해주세요.' });
      return;
    }
    setTestingSensTrial(true);
    setMessage(null);
    try {
      await notificationsAPI.sendTestSensTrial(testPhoneSensTrial);
      setMessage({ type: 'success', text: 'SENS 체험수업 테스트 메시지가 발송되었습니다.' });
      loadLogs();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.message || 'SENS 체험수업 테스트 발송에 실패했습니다.' });
    } finally {
      setTestingSensTrial(false);
    }
  };

  const handleTestSensOverdue = async () => {
    if (!testPhoneSensOverdue) {
      setMessage({ type: 'error', text: '테스트 전화번호를 입력해주세요.' });
      return;
    }
    setTestingSensOverdue(true);
    setMessage(null);
    try {
      await notificationsAPI.sendTestSensOverdue(testPhoneSensOverdue);
      setMessage({ type: 'success', text: 'SENS 미납자 테스트 메시지가 발송되었습니다.' });
      loadLogs();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.message || 'SENS 미납자 테스트 발송에 실패했습니다.' });
    } finally {
      setTestingSensOverdue(false);
    }
  };

  const handleTestSensReminder = async () => {
    if (!testPhoneSensReminder) {
      setMessage({ type: 'error', text: '테스트 전화번호를 입력해주세요.' });
      return;
    }
    setTestingSensReminder(true);
    setMessage(null);
    try {
      await notificationsAPI.sendTestSensReminder(testPhoneSensReminder);
      setMessage({ type: 'success', text: 'SENS 상담 리마인드 테스트 메시지가 발송되었습니다.' });
      loadLogs();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.message || 'SENS 상담 리마인드 테스트 발송에 실패했습니다.' });
    } finally {
      setTestingSensReminder(false);
    }
  };

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
    testingAttendance, testingSensAttendance,
    testPhone, setTestPhone,
    testPhoneConsultation, setTestPhoneConsultation,
    testPhoneTrial, setTestPhoneTrial,
    testPhoneOverdue, setTestPhoneOverdue,
    testPhoneReminder, setTestPhoneReminder,
    testPhoneSensConsultation, setTestPhoneSensConsultation,
    testPhoneSensTrial, setTestPhoneSensTrial,
    testPhoneSensOverdue, setTestPhoneSensOverdue,
    testPhoneSensReminder, setTestPhoneSensReminder,
    testPhoneAttendance, setTestPhoneAttendance,
    testPhoneSensAttendance, setTestPhoneSensAttendance,
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
    handleTestAttendance,
    handleTestSensAttendance,
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
