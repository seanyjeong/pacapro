'use client';

import { useState, useEffect } from 'react';
import { Bell, Key, Send, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, ExternalLink, Users, X, DollarSign, Plus, Trash2, Image, GraduationCap } from 'lucide-react';
import { notificationsAPI, NotificationSettings, NotificationLog, ConsultationButton } from '@/lib/api/notifications';
import PushNotificationSettings from '@/components/push-notification-settings';

type ServiceType = 'sens' | 'solapi';
type TemplateType = 'unpaid' | 'consultation' | 'trial';

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    service_type: 'sens',
    // SENS
    naver_access_key: '',
    naver_secret_key: '',
    naver_service_id: '',
    sms_service_id: '',
    kakao_channel_id: '',
    template_code: '',
    template_content: '',
    // 솔라피
    solapi_api_key: '',
    solapi_api_secret: '',
    solapi_pfid: '',
    solapi_sender_phone: '',
    solapi_template_id: '',
    solapi_template_content: '',
    // 상담확정 알림톡
    solapi_consultation_template_id: '',
    solapi_consultation_template_content: '',
    solapi_consultation_buttons: [],
    solapi_consultation_image_url: '',
    // 체험수업 알림톡
    solapi_trial_template_id: '',
    solapi_trial_template_content: '',
    solapi_trial_buttons: [],
    solapi_trial_image_url: '',
    // 공통
    is_enabled: false,        // SENS 활성화
    solapi_enabled: false,    // 솔라피 활성화
    solapi_auto_enabled: false,  // 솔라피 자동발송 활성화
    solapi_auto_hour: 10,        // 솔라피 자동발송 시간
    auto_send_day: 0,
    auto_send_days: '',
    auto_send_hour: 9,
  });

  // 현재 선택된 서비스 탭 (보기용, 실제 저장은 service_type)
  const [activeTab, setActiveTab] = useState<ServiceType>('sens');

  // 선택된 자동발송 날짜들을 배열로 관리
  const selectedDays = settings.auto_send_days
    ? settings.auto_send_days.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d))
    : [];

  const toggleDay = (day: number) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day].sort((a, b) => a - b);
    setSettings(prev => ({
      ...prev,
      auto_send_days: newDays.join(','),
      auto_send_day: 0 // 다중 날짜 사용시 단일 날짜는 0으로
    }));
  };
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingConsultation, setTestingConsultation] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testPhoneConsultation, setTestPhoneConsultation] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sendingUnpaid, setSendingUnpaid] = useState(false);

  // 가격 비교 모달
  const [showPriceModal, setShowPriceModal] = useState(false);

  // 가이드 아코디언 상태
  const [openGuides, setOpenGuides] = useState<Record<string, boolean>>({});

  // 현재 선택된 템플릿 탭
  const [activeTemplate, setActiveTemplate] = useState<TemplateType>('unpaid');

  useEffect(() => {
    loadSettings();
    loadLogs();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await notificationsAPI.getSettings();
      setSettings(data);
      // 현재 선택된 서비스 타입으로 탭 설정
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

  // 상담확정 버튼 추가
  const addConsultationButton = () => {
    const newButton: ConsultationButton = {
      buttonType: 'WL',
      buttonName: '',
      linkMo: '',
      linkPc: '',
    };
    setSettings(prev => ({
      ...prev,
      solapi_consultation_buttons: [...(prev.solapi_consultation_buttons || []), newButton],
    }));
  };

  // 상담확정 버튼 삭제
  const removeConsultationButton = (index: number) => {
    setSettings(prev => ({
      ...prev,
      solapi_consultation_buttons: prev.solapi_consultation_buttons.filter((_, i) => i !== index),
    }));
  };

  // 상담확정 버튼 수정
  const updateConsultationButton = (index: number, field: keyof ConsultationButton, value: string) => {
    setSettings(prev => ({
      ...prev,
      solapi_consultation_buttons: prev.solapi_consultation_buttons.map((btn, i) =>
        i === index ? { ...btn, [field]: value } : btn
      ),
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

  // 체험수업 버튼 추가
  const addTrialButton = () => {
    const newButton: ConsultationButton = {
      buttonType: 'WL',
      buttonName: '',
      linkMo: '',
      linkPc: '',
    };
    setSettings(prev => ({
      ...prev,
      solapi_trial_buttons: [...(prev.solapi_trial_buttons || []), newButton],
    }));
  };

  // 체험수업 버튼 삭제
  const removeTrialButton = (index: number) => {
    setSettings(prev => ({
      ...prev,
      solapi_trial_buttons: prev.solapi_trial_buttons.filter((_, i) => i !== index),
    }));
  };

  // 체험수업 버튼 수정
  const updateTrialButton = (index: number, field: keyof ConsultationButton, value: string) => {
    setSettings(prev => ({
      ...prev,
      solapi_trial_buttons: prev.solapi_trial_buttons.map((btn, i) =>
        i === index ? { ...btn, [field]: value } : btn
      ),
    }));
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-800"><CheckCircle className="w-3 h-3" /> 발송</span>;
      case 'failed':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 text-red-800"><XCircle className="w-3 h-3" /> 실패</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3" /> 대기</span>;
    }
  };

  // 서비스 타입 변경 시 settings도 업데이트
  const handleServiceTypeChange = (type: ServiceType) => {
    setActiveTab(type);
    setSettings(prev => ({ ...prev, service_type: type }));
  };

  // 현재 선택된 서비스의 템플릿 내용
  const currentTemplateContent = activeTab === 'solapi'
    ? settings.solapi_template_content
    : settings.template_content;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">알림톡 및 SMS 설정</h1>
          <p className="text-muted-foreground">KakaoTalk 알림톡과 SMS 발송을 위한 설정</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* PWA 푸시 알림 설정 */}
      <PushNotificationSettings />

      {/* 서비스 선택 탭 */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">서비스 선택</h2>
          <button
            onClick={() => setShowPriceModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            가격 비교
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => handleServiceTypeChange('sens')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'sens'
                ? 'bg-green-600 text-white'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            네이버 SENS
          </button>
          <button
            onClick={() => handleServiceTypeChange('solapi')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'solapi'
                ? 'bg-purple-600 text-white'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            솔라피 (Solapi)
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          현재 사용 중: <strong className="text-foreground">{settings.service_type === 'solapi' ? '솔라피' : '네이버 SENS'}</strong>
          {settings.service_type !== activeTab && (
            <span className="text-amber-600 ml-2">(변경 후 저장 필요)</span>
          )}
        </p>
      </div>

      {/* 가격 비교 모달 */}
      {showPriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPriceModal(false)}>
          <div className="bg-card rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">서비스별 가격 비교</h3>
              <button onClick={() => setShowPriceModal(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-foreground">메시지 유형</th>
                    <th className="text-center py-3 px-2 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">SENS</th>
                    <th className="text-center py-3 px-2 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300">솔라피</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-3 px-2 font-medium text-foreground">단문 SMS (90byte)</td>
                    <td className="text-center py-3 px-2 bg-green-50 dark:bg-green-950">
                      <span className="text-green-600 dark:text-green-400 font-medium">50건 무료</span>
                      <br /><span className="text-muted-foreground text-xs">초과 시 9원</span>
                    </td>
                    <td className="text-center py-3 px-2 bg-purple-50 dark:bg-purple-950 text-foreground">18원</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-2 font-medium text-foreground">장문 LMS (2,000byte)</td>
                    <td className="text-center py-3 px-2 bg-green-50 dark:bg-green-950">
                      <span className="text-green-600 dark:text-green-400 font-medium">10건 무료</span>
                      <br /><span className="text-muted-foreground text-xs">초과 시 30원</span>
                    </td>
                    <td className="text-center py-3 px-2 bg-purple-50 dark:bg-purple-950 text-foreground">45원</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-2 font-medium text-foreground">사진 MMS</td>
                    <td className="text-center py-3 px-2 bg-green-50 dark:bg-green-950 text-foreground">100원</td>
                    <td className="text-center py-3 px-2 bg-purple-50 dark:bg-purple-950 text-foreground">110원</td>
                  </tr>
                  <tr className="border-b border-border bg-yellow-50 dark:bg-yellow-950">
                    <td className="py-3 px-2 font-medium text-foreground">카카오 알림톡</td>
                    <td className="text-center py-3 px-2 font-semibold text-green-700 dark:text-green-300">7.5원</td>
                    <td className="text-center py-3 px-2 text-foreground">13원</td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-3 px-2 font-medium text-foreground">카카오 친구톡</td>
                    <td className="text-center py-3 px-2 bg-green-50 dark:bg-green-950 text-foreground">~15원</td>
                    <td className="text-center py-3 px-2 bg-purple-50 dark:bg-purple-950 text-foreground">19원</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-2 font-medium text-foreground">친구톡 이미지</td>
                    <td className="text-center py-3 px-2 bg-green-50 dark:bg-green-950 text-foreground">~25원</td>
                    <td className="text-center py-3 px-2 bg-purple-50 dark:bg-purple-950 text-foreground">29원</td>
                  </tr>
                </tbody>
              </table>

              {/* 장단점 비교 */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="font-medium text-green-800 dark:text-green-200 mb-2">SENS 장단점</p>
                  <div className="text-xs space-y-1">
                    <p className="text-green-700 dark:text-green-300">✓ 저렴한 가격</p>
                    <p className="text-green-700 dark:text-green-300">✓ 네이버 클라우드 통합</p>
                    <p className="text-red-600 dark:text-red-400">✗ 가입 절차 복잡</p>
                    <p className="text-red-600 dark:text-red-400">✗ 설정이 다소 어려움</p>
                  </div>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="font-medium text-purple-800 dark:text-purple-200 mb-2">솔라피 장단점</p>
                  <div className="text-xs space-y-1">
                    <p className="text-green-700 dark:text-green-300">✓ 가입/설정 간편</p>
                    <p className="text-green-700 dark:text-green-300">✓ 직관적인 UI</p>
                    <p className="text-red-600 dark:text-red-400">✗ SENS 대비 비싼 가격</p>
                    <p className="text-red-600 dark:text-red-400">✗ 대량 발송 시 비용 부담</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  * 가격은 변동될 수 있으며, 대량 발송 시 할인이 적용될 수 있습니다.
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                  * 정확한 가격은 각 공식 사이트에서 확인하세요.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <a
                  href="https://www.ncloud.com/product/applicationService/sens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  SENS 공식 사이트 <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href="https://solapi.com/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  솔라피 공식 사이트 <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SENS 설정 */}
      {activeTab === 'sens' && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-foreground">네이버 SENS API 설정</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Naver Cloud Access Key
              </label>
              <input
                type="text"
                value={settings.naver_access_key}
                onChange={e => setSettings(prev => ({ ...prev, naver_access_key: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Access Key ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Naver Cloud Secret Key
              </label>
              <input
                type="password"
                value={settings.naver_secret_key}
                onChange={e => setSettings(prev => ({ ...prev, naver_secret_key: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder={settings.has_secret_key ? '저장됨 (변경하려면 새로 입력)' : 'Secret Key'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                알림톡 Service ID
              </label>
              <input
                type="text"
                value={settings.naver_service_id}
                onChange={e => setSettings(prev => ({ ...prev, naver_service_id: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="ncp:kkobizmsg:kr:..."
              />
              <p className="text-xs text-muted-foreground mt-1">알림톡 전용 (SENS &gt; 알림톡 &gt; 프로젝트)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                SMS Service ID
              </label>
              <input
                type="text"
                value={settings.sms_service_id}
                onChange={e => setSettings(prev => ({ ...prev, sms_service_id: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="ncp:sms:kr:..."
              />
              <p className="text-xs text-muted-foreground mt-1">SMS 전용 (SENS &gt; SMS &gt; 프로젝트)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                KakaoTalk 채널 ID
              </label>
              <input
                type="text"
                value={settings.kakao_channel_id}
                onChange={e => setSettings(prev => ({ ...prev, kakao_channel_id: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="@채널ID"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                템플릿 코드 (Naver에서 승인받은 코드)
              </label>
              <input
                type="text"
                value={settings.template_code}
                onChange={e => setSettings(prev => ({ ...prev, template_code: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="예: A06"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">
                템플릿 본문 (승인받은 템플릿 내용 그대로 입력)
              </label>
              <textarea
                value={settings.template_content}
                onChange={e => setSettings(prev => ({ ...prev, template_content: e.target.value }))}
                rows={6}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                placeholder={`수강료안내
#{이름} 학생의 수강료 납부일이,
#{날짜} 일입니다
계좌 ○○은행 000-000000-00000 홍길동`}
              />
            </div>
          </div>
        </div>
      )}

      {/* 솔라피 API 설정 (공통) */}
      {activeTab === 'solapi' && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-foreground">솔라피 API 설정</h2>
            <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">공통</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                API Key
              </label>
              <input
                type="text"
                value={settings.solapi_api_key}
                onChange={e => setSettings(prev => ({ ...prev, solapi_api_key: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="API Key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                API Secret
              </label>
              <input
                type="password"
                value={settings.solapi_api_secret}
                onChange={e => setSettings(prev => ({ ...prev, solapi_api_secret: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder={settings.has_solapi_secret ? '저장됨 (변경하려면 새로 입력)' : 'API Secret'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                카카오 채널 ID (pfId)
              </label>
              <input
                type="text"
                value={settings.solapi_pfid}
                onChange={e => setSettings(prev => ({ ...prev, solapi_pfid: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="KA01PF..."
              />
              <p className="text-xs text-muted-foreground mt-1">솔라피 콘솔에서 확인 가능</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                발신번호
              </label>
              <input
                type="text"
                value={settings.solapi_sender_phone}
                onChange={e => setSettings(prev => ({ ...prev, solapi_sender_phone: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="010-1234-5678"
              />
              <p className="text-xs text-muted-foreground mt-1">솔라피에 등록된 발신번호</p>
            </div>
          </div>
        </div>
      )}

      {/* 템플릿 선택 탭 */}
      {activeTab === 'solapi' && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <h2 className="text-lg font-semibold text-foreground mb-4">알림톡 템플릿 설정</h2>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveTemplate('unpaid')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                activeTemplate === 'unpaid'
                  ? 'bg-orange-600 text-white'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              미납자 알림톡
              {settings.solapi_template_id && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${activeTemplate === 'unpaid' ? 'bg-white/20' : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'}`}>설정됨</span>
              )}
            </button>
            <button
              onClick={() => setActiveTemplate('consultation')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                activeTemplate === 'consultation'
                  ? 'bg-green-600 text-white'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              <Bell className="w-4 h-4" />
              상담확정 알림톡
              {settings.solapi_consultation_template_id && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${activeTemplate === 'consultation' ? 'bg-white/20' : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'}`}>설정됨</span>
              )}
            </button>
            <button
              onClick={() => setActiveTemplate('trial')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                activeTemplate === 'trial'
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              체험수업 알림톡
              {settings.solapi_trial_template_id && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${activeTemplate === 'trial' ? 'bg-white/20' : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'}`}>설정됨</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 미납자 알림톡 템플릿 */}
      {activeTab === 'solapi' && activeTemplate === 'unpaid' && (
        <div className="bg-card rounded-lg shadow-sm border border-orange-200 dark:border-orange-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">
                템플릿 ID
                  </label>
                  <input
                    type="text"
                    value={settings.solapi_template_id}
                    onChange={e => setSettings(prev => ({ ...prev, solapi_template_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="KA01TP..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    템플릿 본문 (미리보기용)
                  </label>
                  <textarea
                    value={settings.solapi_template_content}
                    onChange={e => setSettings(prev => ({ ...prev, solapi_template_content: e.target.value }))}
                    rows={5}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono text-sm"
                    placeholder={`안녕하세요, 맥스체대입시입니다.
#{이름} 학생의 #{월}월 학원비가 미납되었습니다.
금액: #{금액}원`}
                  />
                </div>

                <div className="md:col-span-2 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">사용 가능한 변수</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <code className="bg-card px-2 py-1 rounded border border-border text-orange-700 dark:text-orange-300">{'#{이름}'}</code>
                      <span className="text-muted-foreground">학생명</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-card px-2 py-1 rounded border border-border text-orange-700 dark:text-orange-300">{'#{월}'}</code>
                      <span className="text-muted-foreground">청구 월</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-card px-2 py-1 rounded border border-border text-orange-700 dark:text-orange-300">{'#{금액}'}</code>
                      <span className="text-muted-foreground">미납 금액</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-card px-2 py-1 rounded border border-border text-orange-700 dark:text-orange-300">{'#{날짜}'}</code>
                      <span className="text-muted-foreground">납부일</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-card px-2 py-1 rounded border border-border text-orange-700 dark:text-orange-300">{'#{학원명}'}</code>
                      <span className="text-muted-foreground">학원 이름</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-card px-2 py-1 rounded border border-border text-orange-700 dark:text-orange-300">{'#{학원전화}'}</code>
                      <span className="text-muted-foreground">학원 전화</span>
                    </div>
                  </div>
                </div>

                {/* 미납자 알림톡 미리보기 */}
                {settings.solapi_template_content && (
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium text-foreground mb-2">미리보기</p>
                    <div className="bg-[#B2C7D9] rounded-2xl p-4 max-w-sm mx-auto shadow-lg">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#9BB3C7]">
                        <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-yellow-800" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.86 5.31 4.64 6.72-.22.82-.87 3.04-.92 3.28 0 0-.02.08.04.11.06.03.12.01.12.01.17-.02 3.03-1.97 3.58-2.33.83.12 1.69.18 2.54.18 5.52 0 10-3.58 10-8 0-4.42-4.48-8-10-8z"/>
                          </svg>
                        </div>
                        <span className="font-medium text-gray-800 text-sm">알림톡</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-600 mb-1">맥스체대입시</p>
                          <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-sm">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                              {settings.solapi_template_content
                                .replace(/#{이름}/g, '홍길동')
                                .replace(/#{학생명}/g, '홍길동')
                                .replace(/#{월}/g, '12')
                                .replace(/#{금액}/g, '300,000')
                                .replace(/#{날짜}/g, '10일')
                                .replace(/#{학원명}/g, '맥스체대입시')
                                .replace(/#{학원전화}/g, '010-0000-0000')
                              }
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">오전 9:00</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 발송 설정 */}
                <div className="md:col-span-2 border-t border-border pt-4 mt-2">
                  <h4 className="font-medium text-foreground mb-4">발송 설정</h4>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">알림톡 활성화</p>
                        <p className="text-sm text-muted-foreground">미납자 알림톡 발송 기능 활성화</p>
                      </div>
                      <button
                        onClick={() => setSettings(prev => ({ ...prev, solapi_enabled: !prev.solapi_enabled }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.solapi_enabled ? 'bg-orange-600' : 'bg-muted'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.solapi_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">자동 발송</p>
                        <p className="text-sm text-muted-foreground">오늘 수업 있는 미납자에게 자동 발송</p>
                      </div>
                      <button
                        onClick={() => setSettings(prev => ({ ...prev, solapi_auto_enabled: !prev.solapi_auto_enabled }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.solapi_auto_enabled ? 'bg-orange-600' : 'bg-muted'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.solapi_auto_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        자동 발송 시간
                      </label>
                      <div className="flex items-center gap-3">
                        <select
                          value={settings.solapi_auto_hour ?? 10}
                          onChange={e => setSettings(prev => ({ ...prev, solapi_auto_hour: parseInt(e.target.value) }))}
                          className="px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        >
                          {[...Array(24)].map((_, hour) => (
                            <option key={hour} value={hour}>
                              {hour.toString().padStart(2, '0')}:00
                            </option>
                          ))}
                        </select>
                        <span className="text-sm text-muted-foreground">
                          매일 {(settings.solapi_auto_hour ?? 10).toString().padStart(2, '0')}시에 발송
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                      <p className="text-sm text-orange-800 dark:text-orange-200">
                        <strong>발송 대상:</strong> 오늘 수업이 예정된 미납 학생
                      </p>
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                        예: 월/수/금 수업인 학생은 월/수/금에만 알림톡을 받습니다.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 테스트 및 수동 발송 */}
                <div className="md:col-span-2 border-t border-border pt-4 mt-2">
                  <h4 className="font-medium text-foreground mb-4">테스트 및 수동 발송</h4>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">테스트 발송</label>
                      <div className="flex gap-3">
                        <input
                          type="tel"
                          value={testPhone}
                          onChange={e => setTestPhone(e.target.value)}
                          className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          placeholder="010-1234-5678"
                        />
                        <button
                          onClick={handleTest}
                          disabled={testing || !settings.solapi_enabled}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {testing ? '발송 중...' : '테스트'}
                        </button>
                      </div>
                      {!settings.solapi_enabled && (
                        <p className="text-sm text-amber-600 mt-1">알림톡을 활성화해야 테스트 발송이 가능합니다</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">미납자 수동 발송</label>
                      <button
                        onClick={handleSendUnpaid}
                        disabled={sendingUnpaid || !settings.solapi_enabled}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingUnpaid ? '발송 중...' : `${new Date().getMonth() + 1}월 미납자에게 즉시 발송`}
                      </button>
                    </div>
                  </div>
                </div>

            {/* 저장 버튼 */}
            <div className="md:col-span-2 pt-4 border-t border-border">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? '저장 중...' : '미납자 알림톡 설정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상담확정 알림톡 템플릿 */}
      {activeTab === 'solapi' && activeTemplate === 'consultation' && (
        <div className="bg-card rounded-lg shadow-sm border border-green-200 dark:border-green-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">
                템플릿 ID
                  </label>
                  <input
                    type="text"
                    value={settings.solapi_consultation_template_id}
                    onChange={e => setSettings(prev => ({ ...prev, solapi_consultation_template_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="KA01TP..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    템플릿 본문 (미리보기용)
                  </label>
                  <textarea
                    value={settings.solapi_consultation_template_content}
                    onChange={e => setSettings(prev => ({ ...prev, solapi_consultation_template_content: e.target.value }))}
                    rows={5}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                    placeholder={`안녕하세요, 맥스체대입시입니다.

#{이름}님의 상담 예약이 확정되었습니다.

■ 상담 일시: #{날짜} #{시간}
■ 예약번호: #{예약번호}

일정 변경이 필요하시면 아래 버튼을 눌러주세요.`}
                  />
                </div>

                <div className="md:col-span-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">사용 가능한 변수</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <code className="bg-card px-2 py-1 rounded border border-border text-green-700 dark:text-green-300">{'#{이름}'}</code>
                      <span className="text-muted-foreground">학생명</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-card px-2 py-1 rounded border border-border text-green-700 dark:text-green-300">{'#{날짜}'}</code>
                      <span className="text-muted-foreground">상담일</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-card px-2 py-1 rounded border border-border text-green-700 dark:text-green-300">{'#{시간}'}</code>
                      <span className="text-muted-foreground">상담시간</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-card px-2 py-1 rounded border border-border text-green-700 dark:text-green-300">{'#{예약번호}'}</code>
                      <span className="text-muted-foreground">예약번호</span>
                    </div>
                  </div>
                </div>

                {/* 상담확정 알림톡 미리보기 */}
                {settings.solapi_consultation_template_content && (
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium text-foreground mb-2">미리보기</p>
                    <div className="bg-[#B2C7D9] rounded-2xl p-4 max-w-sm mx-auto shadow-lg">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#9BB3C7]">
                        <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-yellow-800" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.86 5.31 4.64 6.72-.22.82-.87 3.04-.92 3.28 0 0-.02.08.04.11.06.03.12.01.12.01.17-.02 3.03-1.97 3.58-2.33.83.12 1.69.18 2.54.18 5.52 0 10-3.58 10-8 0-4.42-4.48-8-10-8z"/>
                          </svg>
                        </div>
                        <span className="font-medium text-gray-800 text-sm">알림톡</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-600 mb-1">맥스체대입시</p>
                          <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-sm">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                              {settings.solapi_consultation_template_content
                                .replace(/#{이름}/g, '홍길동')
                                .replace(/#{날짜}/g, '12월 20일')
                                .replace(/#{시간}/g, '14:00')
                                .replace(/#{예약번호}/g, 'C20251215001')
                              }
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">오전 9:00</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 이미지 URL 설정 */}
                <div className="md:col-span-2 border-t border-border pt-4 mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Image className="w-4 h-4 text-muted-foreground" />
                    <h4 className="font-medium text-foreground">이미지 설정 (선택)</h4>
                  </div>
                  <input
                    type="url"
                    value={settings.solapi_consultation_image_url || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, solapi_consultation_image_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="https://example.com/image.jpg (이미지 알림톡인 경우)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">이미지 알림톡 템플릿인 경우에만 입력하세요</p>
                </div>

                {/* 버튼 설정 */}
                <div className="md:col-span-2 border-t border-border pt-4 mt-2">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-foreground">버튼 설정</h4>
                    <button
                      type="button"
                      onClick={addConsultationButton}
                      disabled={(settings.solapi_consultation_buttons?.length || 0) >= 5}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                      버튼 추가
                    </button>
                  </div>

                  {(settings.solapi_consultation_buttons?.length || 0) === 0 ? (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      버튼이 없습니다. 템플릿에 버튼이 있다면 위의 &quot;버튼 추가&quot; 버튼을 클릭하세요.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {settings.solapi_consultation_buttons?.map((button, index) => (
                        <div key={index} className="p-4 bg-muted/30 rounded-lg border border-border">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-foreground">버튼 {index + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeConsultationButton(index)}
                              className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">버튼 타입</label>
                              <select
                                value={button.buttonType}
                                onChange={(e) => updateConsultationButton(index, 'buttonType', e.target.value)}
                                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm"
                              >
                                <option value="WL">웹링크 (WL)</option>
                                <option value="AL">앱링크 (AL)</option>
                                <option value="BK">봇키워드 (BK)</option>
                                <option value="MD">메시지전달 (MD)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">버튼 이름</label>
                              <input
                                type="text"
                                value={button.buttonName || ''}
                                onChange={(e) => updateConsultationButton(index, 'buttonName', e.target.value)}
                                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm"
                                placeholder="예: 일정 변경하기"
                              />
                            </div>
                            {button.buttonType === 'WL' && (
                              <>
                                <div>
                                  <label className="block text-xs text-muted-foreground mb-1">모바일 링크</label>
                                  <input
                                    type="url"
                                    value={button.linkMo || ''}
                                    onChange={(e) => updateConsultationButton(index, 'linkMo', e.target.value)}
                                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm"
                                    placeholder="https://..."
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-muted-foreground mb-1">PC 링크 (선택)</label>
                                  <input
                                    type="url"
                                    value={button.linkPc || ''}
                                    onChange={(e) => updateConsultationButton(index, 'linkPc', e.target.value)}
                                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm"
                                    placeholder="https://... (미입력시 모바일 링크 사용)"
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    * 솔라피에서 등록한 템플릿의 버튼과 동일하게 설정해야 합니다
                  </p>
                </div>

                {/* 발송 안내 */}
                <div className="md:col-span-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>자동 발송:</strong> 상담 예약을 &apos;확정&apos;으로 변경하면 자동으로 발송됩니다.
                  </p>
                </div>

                {/* 테스트 발송 */}
                <div className="md:col-span-2 border-t border-border pt-4 mt-2">
                  <h4 className="font-medium text-foreground mb-4">테스트 발송</h4>
                  <div className="flex gap-3">
                    <input
                      type="tel"
                      value={testPhoneConsultation}
                      onChange={e => setTestPhoneConsultation(e.target.value)}
                      className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="010-1234-5678"
                    />
                    <button
                      onClick={handleTestConsultation}
                      disabled={testingConsultation || !settings.solapi_consultation_template_id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testingConsultation ? '발송 중...' : '테스트'}
                    </button>
                  </div>
                  {!settings.solapi_consultation_template_id && (
                    <p className="text-sm text-amber-600 mt-1">템플릿 ID를 먼저 설정해야 테스트 발송이 가능합니다</p>
                  )}
                </div>

            {/* 저장 버튼 */}
            <div className="md:col-span-2 pt-4 border-t border-border">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? '저장 중...' : '상담확정 알림톡 설정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 체험수업 알림톡 템플릿 */}
      {activeTab === 'solapi' && activeTemplate === 'trial' && (
        <div className="bg-card rounded-lg shadow-sm border border-blue-200 dark:border-blue-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 ID</label>
              <input
                type="text"
                value={settings.solapi_trial_template_id}
                onChange={e => setSettings(prev => ({ ...prev, solapi_trial_template_id: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="KA01TP..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">템플릿 본문 (미리보기용)</label>
              <textarea
                value={settings.solapi_trial_template_content}
                onChange={e => setSettings(prev => ({ ...prev, solapi_trial_template_content: e.target.value }))}
                rows={5}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder={`안녕하세요, #{학원명}입니다.

#{이름}님의 체험수업 일정을 안내드립니다.

■ 체험수업 일시: #{날짜} #{시간}

문의사항은 #{학원전화}로 연락주세요.`}
              />
            </div>

            <div className="md:col-span-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">사용 가능한 변수</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <code className="bg-card px-2 py-1 rounded border border-border text-blue-700 dark:text-blue-300">{'#{이름}'}</code>
                  <span className="text-muted-foreground">학생명</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-card px-2 py-1 rounded border border-border text-blue-700 dark:text-blue-300">{'#{날짜}'}</code>
                  <span className="text-muted-foreground">수업일</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-card px-2 py-1 rounded border border-border text-blue-700 dark:text-blue-300">{'#{시간}'}</code>
                  <span className="text-muted-foreground">수업시간</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-card px-2 py-1 rounded border border-border text-blue-700 dark:text-blue-300">{'#{학원명}'}</code>
                  <span className="text-muted-foreground">학원이름</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-card px-2 py-1 rounded border border-border text-blue-700 dark:text-blue-300">{'#{학원전화}'}</code>
                  <span className="text-muted-foreground">학원전화</span>
                </div>
              </div>
            </div>

            {/* 체험수업 알림톡 미리보기 */}
            {settings.solapi_trial_template_content && (
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-foreground mb-2">미리보기</p>
                <div className="bg-[#B2C7D9] rounded-2xl p-4 max-w-sm mx-auto shadow-lg">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#9BB3C7]">
                    <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-yellow-800" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.86 5.31 4.64 6.72-.22.82-.87 3.04-.92 3.28 0 0-.02.08.04.11.06.03.12.01.12.01.17-.02 3.03-1.97 3.58-2.33.83.12 1.69.18 2.54.18 5.52 0 10-3.58 10-8 0-4.42-4.48-8-10-8z"/>
                      </svg>
                    </div>
                    <span className="font-medium text-gray-800 text-sm">알림톡</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1">학원</p>
                      <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-sm">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {settings.solapi_trial_template_content
                            .replace(/#{이름}/g, '홍길동')
                            .replace(/#{날짜}/g, '12월 20일')
                            .replace(/#{시간}/g, '14:00')
                            .replace(/#{학원명}/g, '맥스체대입시')
                            .replace(/#{학원전화}/g, '010-0000-0000')
                          }
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">오전 9:00</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 이미지 URL 설정 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3">
                <Image className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-medium text-foreground">이미지 설정 (선택)</h4>
              </div>
              <input
                type="url"
                value={settings.solapi_trial_image_url || ''}
                onChange={(e) => setSettings(prev => ({ ...prev, solapi_trial_image_url: e.target.value }))}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://example.com/image.jpg (이미지 알림톡인 경우)"
              />
              <p className="text-xs text-muted-foreground mt-1">이미지 알림톡 템플릿인 경우에만 입력하세요</p>
            </div>

            {/* 버튼 설정 */}
            <div className="md:col-span-2 border-t border-border pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-foreground">버튼 설정</h4>
                <button
                  type="button"
                  onClick={addTrialButton}
                  disabled={(settings.solapi_trial_buttons?.length || 0) >= 5}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  버튼 추가
                </button>
              </div>

              {(settings.solapi_trial_buttons?.length || 0) === 0 ? (
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  버튼이 없습니다. 템플릿에 버튼이 있다면 위의 &quot;버튼 추가&quot; 버튼을 클릭하세요.
                </p>
              ) : (
                <div className="space-y-4">
                  {settings.solapi_trial_buttons?.map((button, index) => (
                    <div key={index} className="p-4 bg-muted/30 rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-foreground">버튼 {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeTrialButton(index)}
                          className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">버튼 타입</label>
                          <select
                            value={button.buttonType}
                            onChange={(e) => updateTrialButton(index, 'buttonType', e.target.value)}
                            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm"
                          >
                            <option value="WL">웹링크 (WL)</option>
                            <option value="AL">앱링크 (AL)</option>
                            <option value="BK">봇키워드 (BK)</option>
                            <option value="MD">메시지전달 (MD)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">버튼 이름</label>
                          <input
                            type="text"
                            value={button.buttonName || ''}
                            onChange={(e) => updateTrialButton(index, 'buttonName', e.target.value)}
                            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm"
                            placeholder="예: 일정 확인하기"
                          />
                        </div>
                        {button.buttonType === 'WL' && (
                          <>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">모바일 링크</label>
                              <input
                                type="url"
                                value={button.linkMo || ''}
                                onChange={(e) => updateTrialButton(index, 'linkMo', e.target.value)}
                                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm"
                                placeholder="https://..."
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">PC 링크 (선택)</label>
                              <input
                                type="url"
                                value={button.linkPc || ''}
                                onChange={(e) => updateTrialButton(index, 'linkPc', e.target.value)}
                                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg text-sm"
                                placeholder="https://... (미입력시 모바일 링크 사용)"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                * 솔라피에서 등록한 템플릿의 버튼과 동일하게 설정해야 합니다
              </p>
            </div>

            {/* 발송 안내 */}
            <div className="md:col-span-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>수동 발송:</strong> 체험수업 알림톡은 학생 상세 페이지에서 수동으로 발송할 수 있습니다.
              </p>
            </div>

            {/* 저장 버튼 */}
            <div className="md:col-span-2 pt-4 border-t border-border">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? '저장 중...' : '체험수업 알림톡 설정 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SENS 발송 설정 - SENS 탭에서만 표시 */}
      {activeTab === 'sens' && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">SENS 발송 설정</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">SENS 알림톡 활성화</p>
                <p className="text-sm text-muted-foreground">활성화해야 자동 발송이 실행됩니다</p>
              </div>
              <button
                onClick={() => setSettings(prev => ({ ...prev, is_enabled: !prev.is_enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.is_enabled ? 'bg-green-600' : 'bg-muted'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.is_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                자동 발송 날짜 (여러 날짜 선택 가능)
              </label>
              <div className="p-3 border border-border rounded-lg bg-muted">
                <div className="grid grid-cols-7 gap-2">
                  {[...Array(28)].map((_, i) => {
                    const day = i + 1;
                    const isSelected = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`p-2 text-sm rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white font-medium'
                            : 'bg-card border border-border text-foreground hover:bg-muted/80'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                {selectedDays.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <span className="font-medium">선택된 날짜:</span> 매월 {selectedDays.join('일, ')}일
                    </p>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                선택한 날짜마다 미납자에게 자동으로 알림이 발송됩니다 (매월 반복)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                자동 발송 시간 (한국 시간)
              </label>
              <div className="flex items-center gap-3">
                <select
                  value={settings.auto_send_hour}
                  onChange={e => setSettings(prev => ({ ...prev, auto_send_hour: parseInt(e.target.value) }))}
                  className="px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {[...Array(24)].map((_, hour) => (
                    <option key={hour} value={hour}>
                      {hour.toString().padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                <span className="text-sm text-muted-foreground">
                  매월 선택한 날짜의 {settings.auto_send_hour.toString().padStart(2, '0')}시 정각에 발송
                </span>
              </div>
            </div>

            {/* 테스트 발송 */}
            <div className="border-t border-border pt-4">
              <label className="block text-sm font-medium text-foreground mb-2">테스트 발송</label>
              <div className="flex gap-3">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="010-1234-5678"
                />
                <button
                  onClick={handleTest}
                  disabled={testing || !settings.is_enabled}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testing ? '발송 중...' : '테스트'}
                </button>
              </div>
              {!settings.is_enabled && (
                <p className="text-sm text-amber-600 mt-1">SENS 알림톡을 활성화해야 테스트 발송이 가능합니다</p>
              )}
            </div>

            {/* 미납자 수동 발송 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">미납자 수동 발송</label>
              <button
                onClick={handleSendUnpaid}
                disabled={sendingUnpaid || !settings.is_enabled}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingUnpaid ? '발송 중...' : `${new Date().getMonth() + 1}월 미납자에게 즉시 발송`}
              </button>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? '저장 중...' : 'SENS 설정 저장'}
            </button>
          </div>
        </div>
      )}

      {/* 설정 가이드 */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">설정 가이드</h2>

        <div className="space-y-2">
          {/* SENS 가이드 */}
          {activeTab === 'sens' && (
            <>
              <div className="border border-border rounded-lg">
                <button
                  onClick={() => toggleGuide('naver')}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted"
                >
                  <span className="font-medium text-foreground">1. Naver Cloud Platform 가입 및 SENS 서비스 등록</span>
                  {openGuides['naver'] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {openGuides['naver'] && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
                    <p>1. <a href="https://www.ncloud.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Naver Cloud Platform <ExternalLink className="w-3 h-3" /></a> 접속 후 회원가입</p>
                    <p>2. 콘솔 → Products & Services → SENS 선택</p>
                    <p>3. 프로젝트 생성 후 Service ID 확인</p>
                    <p>4. 마이페이지 → 인증키 관리 → Access Key/Secret Key 발급</p>
                  </div>
                )}
              </div>

              <div className="border border-border rounded-lg">
                <button
                  onClick={() => toggleGuide('kakao')}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted"
                >
                  <span className="font-medium text-foreground">2. KakaoTalk 비즈니스 채널 생성</span>
                  {openGuides['kakao'] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {openGuides['kakao'] && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
                    <p>1. <a href="https://center-pf.kakao.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">카카오 비즈니스 센터 <ExternalLink className="w-3 h-3" /></a> 접속</p>
                    <p>2. 카카오톡 채널 생성 (비즈니스 채널)</p>
                    <p>3. 채널 ID 확인 (예: @학원이름)</p>
                    <p>4. Naver Cloud SENS에서 KakaoTalk 채널 연동</p>
                  </div>
                )}
              </div>

              <div className="border border-border rounded-lg">
                <button
                  onClick={() => toggleGuide('template')}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted"
                >
                  <span className="font-medium text-foreground">3. 알림톡 템플릿 등록 및 승인</span>
                  {openGuides['template'] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {openGuides['template'] && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
                    <p>1. Naver Cloud SENS 콘솔 → 알림톡 → 템플릿 관리</p>
                    <p>2. 새 템플릿 등록 (아래 예시 참고)</p>
                    <p>3. 카카오 심사 대기 (영업일 기준 2-3일 소요)</p>
                    <p>4. 승인 완료 후 템플릿 코드를 위 설정에 입력</p>
                    <div className="mt-3 p-3 bg-muted rounded text-xs font-mono whitespace-pre-wrap text-foreground">
{`[#{학원명}] 학원비 납부 안내

안녕하세요, #{학생명} 학부모님.

#{월}월 학원비 #{금액}원이 아직 납부되지 않았습니다.

납부기한: #{납부기한}

문의: #{학원전화}

※ 이미 납부하셨다면 이 메시지는 무시해주세요.`}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 솔라피 가이드 */}
          {activeTab === 'solapi' && (
            <>
              <div className="border border-border rounded-lg">
                <button
                  onClick={() => toggleGuide('solapi-signup')}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted"
                >
                  <span className="font-medium text-foreground">1. 솔라피 가입 및 API Key 발급</span>
                  {openGuides['solapi-signup'] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {openGuides['solapi-signup'] && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
                    <p>1. <a href="https://solapi.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">솔라피 <ExternalLink className="w-3 h-3" /></a> 접속 후 회원가입</p>
                    <p>2. 사업자등록증 인증 (알림톡 발송에 필요)</p>
                    <p>3. 콘솔 → API Key 메뉴에서 API Key/Secret 발급</p>
                    <p>4. 발신번호 등록 (문자 발송용)</p>
                  </div>
                )}
              </div>

              <div className="border border-border rounded-lg">
                <button
                  onClick={() => toggleGuide('solapi-channel')}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted"
                >
                  <span className="font-medium text-foreground">2. 카카오톡 채널 연동</span>
                  {openGuides['solapi-channel'] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {openGuides['solapi-channel'] && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
                    <p>1. 솔라피 콘솔 → 알림톡 → 채널 관리</p>
                    <p>2. 카카오톡 채널 연동 (카카오 비즈니스 채널 필요)</p>
                    <p>3. 채널 ID (pfId) 확인 후 위 설정에 입력</p>
                  </div>
                )}
              </div>

              <div className="border border-border rounded-lg">
                <button
                  onClick={() => toggleGuide('solapi-template')}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted"
                >
                  <span className="font-medium text-foreground">3. 알림톡 템플릿 등록</span>
                  {openGuides['solapi-template'] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {openGuides['solapi-template'] && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground space-y-2">
                    <p>1. 솔라피 콘솔 → 알림톡 → 템플릿 관리</p>
                    <p>2. 새 템플릿 등록</p>
                    <p>3. 카카오 심사 대기 (영업일 기준 1-2일)</p>
                    <p>4. 승인 완료 후 템플릿 ID를 위 설정에 입력</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 최근 발송 내역 */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">최근 발송 내역</h2>

        {logs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">발송 내역이 없습니다</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-muted-foreground">발송시간</th>
                  <th className="text-left py-2 px-2 text-muted-foreground">수신자</th>
                  <th className="text-left py-2 px-2 text-muted-foreground">전화번호</th>
                  <th className="text-left py-2 px-2 text-muted-foreground">상태</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-border last:border-0">
                    <td className="py-2 px-2 text-muted-foreground">
                      {log.sent_at ? new Date(log.sent_at).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td className="py-2 px-2 text-foreground">{log.recipient_name || log.student_name || '-'}</td>
                    <td className="py-2 px-2 text-foreground">{log.recipient_phone}</td>
                    <td className="py-2 px-2">{getStatusBadge(log.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
