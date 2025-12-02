'use client';

import { useState, useEffect } from 'react';
import { Bell, Key, Send, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { notificationsAPI, NotificationSettings, NotificationLog } from '@/lib/api/notifications';

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    naver_access_key: '',
    naver_secret_key: '',
    naver_service_id: '',
    sms_service_id: '',
    kakao_channel_id: '',
    template_code: '',
    template_content: '',
    is_enabled: false,
    auto_send_day: 0,
    auto_send_days: '',
  });

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
  const [testPhone, setTestPhone] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 가이드 아코디언 상태
  const [openGuides, setOpenGuides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadSettings();
    loadLogs();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await notificationsAPI.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('설정 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const data = await notificationsAPI.getLogs({ limit: 10 });
      setLogs(data.logs);
    } catch (error) {
      console.error('로그 로드 실패:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await notificationsAPI.saveSettings(settings);
      setMessage({ type: 'success', text: '설정이 저장되었습니다.' });
      loadSettings();
    } catch (error) {
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
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || '테스트 발송에 실패했습니다.' });
    } finally {
      setTesting(false);
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
          <h1 className="text-2xl font-bold text-gray-900">알림톡 및 SMS 설정</h1>
          <p className="text-gray-500">KakaoTalk 알림톡과 SMS 발송을 위한 Naver Cloud SENS 설정</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* API 연동 설정 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold">API 연동 설정</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Naver Cloud Access Key
            </label>
            <input
              type="text"
              value={settings.naver_access_key}
              onChange={e => setSettings(prev => ({ ...prev, naver_access_key: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Access Key ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Naver Cloud Secret Key
            </label>
            <input
              type="password"
              value={settings.naver_secret_key}
              onChange={e => setSettings(prev => ({ ...prev, naver_secret_key: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={settings.has_secret_key ? '저장됨 (변경하려면 새로 입력)' : 'Secret Key'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              알림톡 Service ID
            </label>
            <input
              type="text"
              value={settings.naver_service_id}
              onChange={e => setSettings(prev => ({ ...prev, naver_service_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="ncp:kkobizmsg:kr:..."
            />
            <p className="text-xs text-gray-500 mt-1">알림톡 전용 (SENS &gt; 알림톡 &gt; 프로젝트)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SMS Service ID
            </label>
            <input
              type="text"
              value={settings.sms_service_id}
              onChange={e => setSettings(prev => ({ ...prev, sms_service_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="ncp:sms:kr:..."
            />
            <p className="text-xs text-gray-500 mt-1">SMS 전용 (SENS &gt; SMS &gt; 프로젝트)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              KakaoTalk 채널 ID
            </label>
            <input
              type="text"
              value={settings.kakao_channel_id}
              onChange={e => setSettings(prev => ({ ...prev, kakao_channel_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="@채널ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              템플릿 코드 (Naver에서 승인받은 코드)
            </label>
            <input
              type="text"
              value={settings.template_code}
              onChange={e => setSettings(prev => ({ ...prev, template_code: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="예: A06"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              템플릿 본문 (승인받은 템플릿 내용 그대로 입력)
            </label>
            <textarea
              value={settings.template_content}
              onChange={e => setSettings(prev => ({ ...prev, template_content: e.target.value }))}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder={`수강료안내
#{이름} 학생의 수강료 납부일이,
#{날짜} 일입니다
계좌 하나은행 000-000000-00000 홍길동`}
            />

            {/* 사용 가능한 변수 목록 */}
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-800 mb-2">사용 가능한 변수</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <code className="bg-white px-2 py-1 rounded border text-blue-700">{'#{이름}'}</code>
                  <span className="text-gray-600">학생 이름</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-white px-2 py-1 rounded border text-blue-700">{'#{날짜}'}</code>
                  <span className="text-gray-600">납부기한</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-white px-2 py-1 rounded border text-blue-700">{'#{금액}'}</code>
                  <span className="text-gray-600">학원비</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-white px-2 py-1 rounded border text-blue-700">{'#{월}'}</code>
                  <span className="text-gray-600">청구 월</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-white px-2 py-1 rounded border text-blue-700">{'#{학원명}'}</code>
                  <span className="text-gray-600">학원 이름</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="bg-white px-2 py-1 rounded border text-blue-700">{'#{학원전화}'}</code>
                  <span className="text-gray-600">학원 전화</span>
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                * Naver에 템플릿 등록 시 위 변수명을 그대로 사용해주세요
              </p>
            </div>

            {/* 미리보기 - 변수만 치환하고 나머지는 그대로 */}
            {settings.template_content && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                <p className="text-sm font-medium text-gray-700 mb-2">미리보기 (변수만 예시로 치환)</p>
                <div className="p-3 bg-yellow-50 rounded border border-yellow-200 text-sm whitespace-pre-wrap">
                  {settings.template_content
                    .replace(/#{이름}/g, '홍길동')
                    .replace(/#{학생명}/g, '홍길동')
                    .replace(/#{날짜}/g, '12월 10일')
                    .replace(/#{납부기한}/g, '12월 10일')
                    .replace(/#{금액}/g, '300,000')
                    .replace(/#{월}/g, '12')
                    .replace(/#{학원명}/g, '○○학원')
                    .replace(/#{학원전화}/g, '010-0000-0000')
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 발송 설정 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">발송 설정</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">알림톡 활성화</p>
              <p className="text-sm text-gray-500">활성화해야 알림을 발송할 수 있습니다</p>
            </div>
            <button
              onClick={() => setSettings(prev => ({ ...prev, is_enabled: !prev.is_enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.is_enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.is_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              자동 발송 날짜 (여러 날짜 선택 가능)
            </label>
            <div className="p-3 border border-gray-300 rounded-lg bg-gray-50">
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
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              {selectedDays.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">선택된 날짜:</span> 매월 {selectedDays.join('일, ')}일
                  </p>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              선택한 날짜마다 미납자에게 자동으로 알림이 발송됩니다 (매월 반복)
            </p>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </div>

      {/* 테스트 발송 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold">테스트 발송</h2>
        </div>

        <div className="flex gap-3">
          <input
            type="tel"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="010-1234-5678"
          />
          <button
            onClick={handleTest}
            disabled={testing || !settings.is_enabled}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? '발송 중...' : '테스트 발송'}
          </button>
        </div>
        {!settings.is_enabled && (
          <p className="text-sm text-amber-600 mt-2">알림톡을 활성화해야 테스트 발송이 가능합니다</p>
        )}
      </div>

      {/* 설정 가이드 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">설정 가이드</h2>

        <div className="space-y-2">
          {/* 가이드 1: Naver Cloud 가입 */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleGuide('naver')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
            >
              <span className="font-medium">1. Naver Cloud Platform 가입 및 SENS 서비스 등록</span>
              {openGuides['naver'] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {openGuides['naver'] && (
              <div className="px-4 pb-4 text-sm text-gray-600 space-y-2">
                <p>1. <a href="https://www.ncloud.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">Naver Cloud Platform <ExternalLink className="w-3 h-3" /></a> 접속 후 회원가입</p>
                <p>2. 콘솔 → Products & Services → SENS 선택</p>
                <p>3. 프로젝트 생성 후 Service ID 확인</p>
                <p>4. 마이페이지 → 인증키 관리 → Access Key/Secret Key 발급</p>
              </div>
            )}
          </div>

          {/* 가이드 2: KakaoTalk 채널 */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleGuide('kakao')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
            >
              <span className="font-medium">2. KakaoTalk 비즈니스 채널 생성</span>
              {openGuides['kakao'] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {openGuides['kakao'] && (
              <div className="px-4 pb-4 text-sm text-gray-600 space-y-2">
                <p>1. <a href="https://center-pf.kakao.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">카카오 비즈니스 센터 <ExternalLink className="w-3 h-3" /></a> 접속</p>
                <p>2. 카카오톡 채널 생성 (비즈니스 채널)</p>
                <p>3. 채널 ID 확인 (예: @학원이름)</p>
                <p>4. Naver Cloud SENS에서 KakaoTalk 채널 연동</p>
              </div>
            )}
          </div>

          {/* 가이드 3: 템플릿 등록 */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleGuide('template')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
            >
              <span className="font-medium">3. 알림톡 템플릿 등록 및 승인</span>
              {openGuides['template'] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {openGuides['template'] && (
              <div className="px-4 pb-4 text-sm text-gray-600 space-y-2">
                <p>1. Naver Cloud SENS 콘솔 → 알림톡 → 템플릿 관리</p>
                <p>2. 새 템플릿 등록 (아래 예시 참고)</p>
                <p>3. 카카오 심사 대기 (영업일 기준 2-3일 소요)</p>
                <p>4. 승인 완료 후 템플릿 코드를 위 설정에 입력</p>
                <div className="mt-3 p-3 bg-gray-100 rounded text-xs font-mono whitespace-pre-wrap">
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
        </div>
      </div>

      {/* 최근 발송 내역 */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">최근 발송 내역</h2>

        {logs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">발송 내역이 없습니다</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">발송시간</th>
                  <th className="text-left py-2 px-2">수신자</th>
                  <th className="text-left py-2 px-2">전화번호</th>
                  <th className="text-left py-2 px-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="py-2 px-2 text-gray-500">
                      {log.sent_at ? new Date(log.sent_at).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td className="py-2 px-2">{log.recipient_name || log.student_name || '-'}</td>
                    <td className="py-2 px-2">{log.recipient_phone}</td>
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
